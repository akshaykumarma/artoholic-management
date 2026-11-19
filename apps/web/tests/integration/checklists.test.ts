import { describe, it, expect } from 'vitest';
import { roundsSchema, stepSchema, type Step } from '@artoholic/shared';
import { POST as createEvent } from '../../app/api/v1/events/route';
import { GET as rounds, POST as addRound } from '../../app/api/v1/events/[id]/rounds/route';
import { GET as getStep } from '../../app/api/v1/events/[id]/steps/[stepId]/route';
import { PUT as progress } from '../../app/api/v1/events/[id]/steps/[stepId]/progress/route';
import { POST as submit } from '../../app/api/v1/events/[id]/steps/[stepId]/submit/route';
import { POST as approve } from '../../app/api/v1/damage-reports/[id]/approve/route';
import { POST as reject } from '../../app/api/v1/damage-reports/[id]/reject/route';
import { POST as recheck } from '../../app/api/v1/damage-reports/[id]/recheck/route';
import { GET as listReports } from '../../app/api/v1/damage-reports/route';
import { POST as close } from '../../app/api/v1/events/[id]/close/route';
import { GET as totals } from '../../app/api/v1/events/[id]/totals/route';
import { POST as correct } from '../../app/api/v1/events/[id]/corrections/route';
import { GET as activity } from '../../app/api/v1/events/[id]/activity/route';
import { GET as getEvent } from '../../app/api/v1/events/[id]/route';
import { PATCH as patchWh } from '../../app/api/v1/warehouses/[id]/route';
import { webSessionFor, type WebSession } from '../session-helpers';
import { basicStock, item, opening } from '../inventory-helpers';
import { balanceOf } from '../../server/stock/balances';
import { getPool } from '../../db/client';
import { makeReq } from '../request';

type As = WebSession['as'];
const at = (d: number, h = 3) => new Date(Date.UTC(2027, 1, 1 + d, h, 30)).toISOString();
const PHOTO = 'damage/2027-02/test.jpg';

async function setup() {
  const admin = await webSessionFor(['admin']);
  const admin2 = await webSessionFor(['admin']);
  const em = await webSessionFor(['event_manager']);
  const sm = await webSessionFor(['store_manager']);
  const { chair, wh, cat } = await basicStock(admin.as, '100');
  const fabric = await item(admin.as, { name: 'Ivory drape fabric', categoryId: cat, trackingType: 'measured', unitCode: 'm' });
  await opening(admin.as, [{ itemId: fabric.id, locationId: wh.defaultLocationId, quantity: '50' }]);
  await patchWh(makeReq('PATCH', '/x', { ...admin.as, body: { storeManagerIds: [sm.user.id] } }), { params: { id: wh.id } });
  return { admin, admin2, em, sm, chair, fabric, wh };
}

async function newEvent(as: As, o: { name: string; em: string; sm?: string; lines: Array<{ itemId: string; qty: string; warehouseId?: string; eventId?: string }>; start: number; end?: number }) {
  const end = o.end ?? o.start;
  const res = await createEvent(makeReq('POST', '/api/v1/events', { ...as, body: {
    name: o.name, venueName: 'Palace Grounds', startsAt: at(o.start, 10), endsAt: at(end, 16), leaveWarehouseAt: at(o.start, 2),
    expectedReturnDate: at(end + 1).slice(0, 10), eventManagerIds: [o.em], storeManagerIds: o.sm ? [o.sm] : [], schedule: true,
    lines: o.lines.map((l) => ({ itemId: l.itemId, plannedQty: l.qty, sources: [l.eventId ? { type: 'event', eventId: l.eventId, qty: l.qty } : { type: 'warehouse', warehouseId: l.warehouseId, qty: l.qty }] }))
  } }));
  if (res.status !== 201) throw new Error(`event ${res.status} ${await res.text()}`);
  return (await res.json()) as { id: string; number: string };
}

const roundsOf = async (as: As, id: string) => roundsSchema.parse(await (await rounds(makeReq('GET', '/x', as), { params: { id } })).json());
const stepId = async (as: As, id: string, step: string, round = 1) => (await roundsOf(as, id)).rounds.find((r) => r.round === round)!.steps.find((s) => s.step === step)!.id;
const load = async (as: As, id: string, sid: string) => stepSchema.parse(await (await getStep(makeReq('GET', '/x', as), { params: { id, stepId: sid } })).json());
const row = (s: Step, itemId: string) => s.rows.find((r) => r.itemId === itemId)!;
async function send(as: As, id: string, sid: string, body: Record<string, unknown>) {
  const res = await submit(makeReq('POST', '/x', { ...as, body }), { params: { id, stepId: sid } });
  return { status: res.status, json: await res.json() };
}
const status = async (as: As, id: string) => (await (await getEvent(makeReq('GET', '/x', as), { params: { id } })).json()).status;
const outbox = async (trigger: string) => (await getPool().query<{ payload: Record<string, unknown> }>('SELECT payload FROM notification_outbox WHERE trigger = $1 ORDER BY id', [trigger])).rows;
const reports = async (as: As, eventId: string, st?: string) => (await (await listReports(makeReq('GET', `/x?eventId=${eventId}${st ? `&status=${st}` : ''}`, as))).json()).items as Array<{ id: string; number: string; kind: string; quantity: string; status: string }>;

describe('event lifecycle (006 quickstart 1, 2, 4, 5, 7–9)', () => {
  it('dispatch → site receipt → decisions → return → warehouse receipt → close → correct', async () => {
    const { admin, admin2, em, sm, chair, fabric, wh } = await setup();
    const ev = await newEvent(admin.as, { name: 'Sangeet', em: em.user.id, sm: sm.user.id, start: 0, lines: [{ itemId: chair.id, qty: '50', warehouseId: wh.id }, { itemId: fabric.id, qty: '12', warehouseId: wh.id }] });
    const r = await roundsOf(sm.as, ev.id);
    expect(r.rounds[0]!.steps.map((s) => s.step)).toEqual(['warehouse_dispatch', 'site_receipt', 'return_dispatch', 'warehouse_receipt']);
    expect(r.rounds[0]!.steps[1]!.ready).toBe(false);

    // US1: warehouse dispatch, part-way save, short needs a reason.
    const d = await stepId(sm.as, ev.id, 'warehouse_dispatch');
    let step = await load(sm.as, ev.id, d);
    expect(row(step, chair.id).expected).toBe('50.000');
    expect((await progress(makeReq('PUT', '/x', { ...sm.as, body: { entries: [{ entryId: row(step, chair.id).entryId, dispatched: '45', done: true }] } }), { params: { id: ev.id, stepId: d } })).status).toBe(200);
    step = await load(sm.as, ev.id, d);
    expect(row(step, chair.id).dispatched).toBe('45.000');
    expect(step.status).toBe('in_progress');
    const fabricEntry = { entryId: row(step, fabric.id).entryId, dispatched: '12' };
    expect((await send(em.as, ev.id, d, { version: step.version, entries: [fabricEntry] })).status).toBe(403);
    const noReason = await send(sm.as, ev.id, d, { version: step.version, entries: [fabricEntry] });
    expect(noReason.status).toBe(400);
    const over = await send(sm.as, ev.id, d, { version: step.version, entries: [fabricEntry, { entryId: row(step, chair.id).entryId, dispatched: '51' }] });
    expect(over.status).toBe(400);
    const ok = await send(sm.as, ev.id, d, { version: step.version, entries: [fabricEntry, { entryId: row(step, chair.id).entryId, dispatched: '45', shortReason: 'damaged_on_pick' }],
      transport: { vehicleNumber: 'KA01AB1234', driverName: 'Ravi', driverPhone: '9876543210' }, location: { latitude: 12.97, longitude: 77.59 } });
    expect(ok.status).toBe(200);
    expect(ok.json.transport).toMatchObject({ vehicleNumber: 'KA01AB1234', driverPhone: '+919876543210' });
    expect(await balanceOf(chair.id, null, 'out')).toBe('45.000');
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'reserved')).toBe('0.000');
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('55.000');
    expect(await status(admin.as, ev.id)).toBe('in_transit');
    expect((await outbox('checklist.dispatch_short'))[0]!.payload.lines).toEqual([{ item: 'White Chiavari Chair', planned: '50.000', dispatched: '45.000', reason: 'damaged_on_pick' }]);
    expect((await outbox('checklist.dispatched'))[0]!.payload.recipientIds).toEqual([em.user.id]);
    expect((await send(sm.as, ev.id, d, { version: step.version, entries: [] })).json.error.code).toBe('STEP_ALREADY_SUBMITTED');

    // US2: site receipt — damage needs a photo, missing must be confirmed.
    const s = await stepId(em.as, ev.id, 'site_receipt');
    step = await load(em.as, ev.id, s);
    expect(row(step, chair.id).expected).toBe('45.000');
    const c = row(step, chair.id).entryId;
    const f = row(step, fabric.id).entryId;
    expect((await send(em.as, ev.id, s, { version: step.version, entries: [{ entryId: c, received: '42', damaged: '2' }, { entryId: f, received: '12' }] })).json.error.code).toBe('PHOTO_REQUIRED');
    const unconfirmed = await send(em.as, ev.id, s, { version: step.version, entries: [{ entryId: c, received: '42', damaged: '2', note: 'legs cracked', photoKeys: [PHOTO] }, { entryId: f, received: '12' }] });
    expect(unconfirmed.json.error).toMatchObject({ code: 'MISSING_NOT_CONFIRMED', details: { lines: [{ missing: '1.000' }] } });
    expect((await send(em.as, ev.id, s, { version: step.version, confirmMissing: true, entries: [{ entryId: c, received: '42', damaged: '2', note: 'legs cracked', photoKeys: [PHOTO] }, { entryId: f, received: '12' }] })).status).toBe(200);
    expect(await status(admin.as, ev.id)).toBe('at_site');
    const atSite = await reports(admin.as, ev.id, 'pending');
    expect(atSite.map((x) => [x.kind, x.quantity])).toEqual(expect.arrayContaining([['damaged', '2.000'], ['missing', '1.000']]));
    expect(atSite.every((x) => /^DMG-\d{4}-\d{5}$/.test(x.number))).toBe(true);
    expect((await outbox('damage.reported'))[0]!.payload.recipientIds).toEqual(expect.arrayContaining([admin.user.id, admin2.user.id]));

    // US3: two Admins approve at once — one wins; a rejected line is re-checked.
    const dmg = atSite.find((x) => x.kind === 'damaged')!;
    const both = await Promise.all([admin, admin2].map((a) => approve(makeReq('POST', '/x', { ...a.as, body: { comment: 'ok' } }), { params: { id: dmg.id } })));
    expect(both.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'damaged')).toBe('2.000');
    const miss = atSite.find((x) => x.kind === 'missing')!;
    expect((await reject(makeReq('POST', '/x', { ...admin.as, body: { comment: 'check the truck again' } }), { params: { id: miss.id } })).status).toBe(200);
    step = await load(em.as, ev.id, s);
    expect(row(step, chair.id).recheckReportId).toBe(miss.id);
    expect((await recheck(makeReq('POST', '/x', { ...em.as, body: { damaged: '0', missing: '0', note: 'found under the stage' } }), { params: { id: miss.id } })).status).toBe(200);

    // US4: return dispatch — consumption only for measured items; damage at return.
    const ret = await stepId(em.as, ev.id, 'return_dispatch');
    step = await load(em.as, ev.id, ret);
    expect(row(step, chair.id).expected).toBe('43.000');
    const rc = row(step, chair.id).entryId;
    const rf = row(step, fabric.id).entryId;
    expect((await send(em.as, ev.id, ret, { version: step.version, entries: [{ entryId: rc, returned: '41', consumed: '2' }, { entryId: rf, returned: '9', consumed: '3' }] })).status).toBe(400);
    const back = await send(em.as, ev.id, ret, { version: step.version, confirmMissing: true, entries: [
      { entryId: rc, returned: '41', damaged: '1', note: 'seat torn', photoKeys: [PHOTO] }, { entryId: rf, returned: '9', consumed: '3' }] });
    expect(back.status).toBe(200);
    expect(await status(admin.as, ev.id)).toBe('returning');
    expect(await balanceOf(fabric.id, null, 'consumed')).toBe('3.000');
    for (const p of await reports(admin.as, ev.id, 'pending')) await approve(makeReq('POST', '/x', { ...admin.as, body: {} }), { params: { id: p.id } });

    // US5: warehouse receipt — 40 of 41 back into the bin, 1 missing.
    const wr = await stepId(sm.as, ev.id, 'warehouse_receipt');
    step = await load(sm.as, ev.id, wr);
    expect(row(step, chair.id)).toMatchObject({ expected: '41.000', binLocationId: wh.defaultLocationId });
    const recv = await send(sm.as, ev.id, wr, { version: step.version, confirmMissing: true, entries: [
      { entryId: row(step, chair.id).entryId, received: '40', binLocationId: wh.defaultLocationId }, { entryId: row(step, fabric.id).entryId, received: '9', binLocationId: wh.defaultLocationId }] });
    expect(recv.status).toBe(200);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('95.000');
    expect(await balanceOf(fabric.id, wh.defaultLocationId, 'available')).toBe('47.000');
    expect(await status(admin.as, ev.id)).toBe('reconciling');

    // US6: closing waits for the last report.
    const blocked = await close(makeReq('POST', '/x', { ...admin.as, body: {} }), { params: { id: ev.id } });
    expect(blocked.status).toBe(409);
    const err = (await blocked.json()).error;
    expect(err.code).toBe('NOT_RECONCILED');
    expect(err.details.reports).toHaveLength(1);
    await approve(makeReq('POST', '/x', { ...admin.as, body: {} }), { params: { id: err.details.reports[0].id } });
    const t = (await (await totals(makeReq('GET', '/x', admin.as), { params: { id: ev.id } })).json()).items;
    expect(t.find((x: { itemName: string }) => x.itemName === 'White Chiavari Chair')).toMatchObject({ dispatched: '45.000', returned: '40.000', damagedApproved: '3.000', lostApproved: '2.000', reconciled: true });
    expect((await close(makeReq('POST', '/x', { ...admin.as, body: {} }), { params: { id: ev.id } })).status).toBe(200);
    expect(await status(admin.as, ev.id)).toBe('closed');
    expect((await outbox('event.closed'))[0]!.payload.recipientIds).toEqual(expect.arrayContaining([em.user.id, sm.user.id]));
    expect(await balanceOf(chair.id, null, 'out')).toBe('0.000');

    // US7: correct a closed event's returned 40 → 39.
    const chairSource = t.find((x: { itemName: string }) => x.itemName === 'White Chiavari Chair').sourceId;
    const corr = await correct(makeReq('POST', '/x', { ...admin.as, body: { lineSourceId: chairSource, field: 'returned', newValue: '39', reason: 'one chair found broken later' } }), { params: { id: ev.id } });
    expect(corr.status).toBe(201);
    expect((await corr.json()).returned).toBe('39.000');
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('94.000');
    const { rows: mv } = await getPool().query("SELECT corrects_movement_id FROM stock_movements WHERE type = 'correction'");
    expect(mv[0].corrects_movement_id).not.toBeNull();
    const log = (await (await activity(makeReq('GET', '/x', admin.as), { params: { id: ev.id } })).json()).items;
    expect(log.find((a: { action: string }) => a.action === 'event.corrected').detail).toMatchObject({ value: '39.000', reason: 'one chair found broken later' });
  });
});

describe('direct handover between events (006 FR-008a, quickstart 6)', () => {
  it('the giving event hands items to the next event, whose site receipt counts as its dispatch', async () => {
    const { admin, em, sm, chair, wh } = await setup();
    const em2 = await webSessionFor(['event_manager']);
    const x = await newEvent(admin.as, { name: 'Sangeet', em: em.user.id, sm: sm.user.id, start: 0, lines: [{ itemId: chair.id, qty: '20', warehouseId: wh.id }] });
    const y = await newEvent(admin.as, { name: 'Reception', em: em2.user.id, start: 1, lines: [{ itemId: chair.id, qty: '20', eventId: x.id }] });
    const go = async (as: As, id: string, type: string, entry: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
      const sid = await stepId(as, id, type);
      const st = await load(as, id, sid);
      return send(as, id, sid, { version: st.version, entries: st.rows.map((r) => ({ entryId: r.entryId, ...entry })), ...extra });
    };
    expect((await go(sm.as, x.id, 'warehouse_dispatch', { dispatched: '20' })).status).toBe(200);
    expect((await go(em.as, x.id, 'site_receipt', { received: '20' })).status).toBe(200);
    expect((await roundsOf(em2.as, y.id)).rounds[0]!.steps.find((s) => s.step === 'site_receipt')!.ready).toBe(false);
    expect((await go(em.as, x.id, 'return_dispatch', { returned: '0', handedOver: '20', handoverEventId: y.id })).status).toBe(200);
    expect(await balanceOf(chair.id, null, 'out')).toBe('20.000');
    const yr = await roundsOf(em2.as, y.id);
    expect(yr.rounds[0]!.steps.map((s) => s.step)).toEqual(['site_receipt', 'return_dispatch', 'warehouse_receipt']);
    const ys = await load(em2.as, y.id, yr.rounds[0]!.steps[0]!.id);
    expect(ys.rows[0]!.expected).toBe('20.000');
    expect((await go(em2.as, y.id, 'site_receipt', { received: '20' })).status).toBe(200);
    expect(await status(admin.as, y.id)).toBe('at_site');
    expect((await go(em2.as, y.id, 'return_dispatch', { returned: '20' })).status).toBe(200);
    expect((await go(sm.as, y.id, 'warehouse_receipt', { received: '20', binLocationId: wh.defaultLocationId })).status).toBe(200);
    expect((await go(sm.as, x.id, 'warehouse_receipt', { received: '0' })).status).toBe(200);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('100.000');
    expect((await close(makeReq('POST', '/x', { ...admin.as, body: {} }), { params: { id: x.id } })).status).toBe(200);
    expect((await close(makeReq('POST', '/x', { ...admin.as, body: {} }), { params: { id: y.id } })).status).toBe(200);
  });
});

describe('add items to a live event (006 US8)', () => {
  it('creates round 2 with its own steps and reservation, without moving the status back', async () => {
    const { admin, em, sm, chair, wh } = await setup();
    const ev = await newEvent(admin.as, { name: 'Rally', em: em.user.id, sm: sm.user.id, start: 0, lines: [{ itemId: chair.id, qty: '30', warehouseId: wh.id }] });
    const d = await stepId(sm.as, ev.id, 'warehouse_dispatch');
    const st = await load(sm.as, ev.id, d);
    await send(sm.as, ev.id, d, { version: st.version, entries: [{ entryId: st.rows[0]!.entryId, dispatched: '30' }] });
    expect((await addRound(makeReq('POST', '/x', { ...admin.as, body: { lines: [{ itemId: chair.id, plannedQty: '20', warehouseId: wh.id }] } }), { params: { id: ev.id } })).status).toBe(201);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'reserved')).toBe('20.000');
    const r = await roundsOf(sm.as, ev.id);
    expect(r.rounds).toHaveLength(2);
    expect(r.rounds[1]!.steps[0]).toMatchObject({ step: 'warehouse_dispatch', status: 'not_started', ready: true });
    expect(r.status).toBe('in_transit');
  });
});
