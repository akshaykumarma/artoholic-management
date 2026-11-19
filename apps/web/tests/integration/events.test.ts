import { describe, it, expect } from 'vitest';
import { eventSchema, eventListSchema, istDate } from '@artoholic/shared';
import { GET as listEvents, POST as createEvent } from '../../app/api/v1/events/route';
import { GET as getEvent, PATCH as patchEvent } from '../../app/api/v1/events/[id]/route';
import { POST as scheduleEvent } from '../../app/api/v1/events/[id]/schedule/route';
import { POST as cancelEvent } from '../../app/api/v1/events/[id]/cancel/route';
import { POST as copyEvent } from '../../app/api/v1/events/[id]/copy/route';
import { POST as availability } from '../../app/api/v1/events/availability/route';
import { GET as handoverSources } from '../../app/api/v1/events/handover-sources/route';
import { GET as today } from '../../app/api/v1/events/today/route';
import { GET as calendar } from '../../app/api/v1/events/calendar/route';
import { PATCH as patchWh } from '../../app/api/v1/warehouses/[id]/route';
import { webSessionFor, type WebSession } from '../session-helpers';
import { basicStock, warehouse, opening } from '../inventory-helpers';
import { balanceOf } from '../../server/stock/balances';
import { runEventReminders } from '../../server/jobs/events/reminders';
import { reservationMismatches } from '../../server/jobs/events/reservation-check';
import { getPool } from '../../db/client';
import { makeReq } from '../request';

type As = WebSession['as'];
const DAY = 86_400_000;
const at = (days: number, hourUtc = 3) => new Date(Date.UTC(2027, 0, 10 + days, hourUtc, 30)).toISOString();
const dateOf = (days: number) => istDate(at(days));

async function setup(qty = '100') {
  const admin = await webSessionFor(['admin']);
  const em = await webSessionFor(['event_manager']);
  const sm = await webSessionFor(['store_manager']);
  const { chair, wh } = await basicStock(admin.as, qty);
  await patchWh(makeReq('PATCH', '/x', { ...admin.as, body: { storeManagerIds: [sm.user.id] } }), { params: { id: wh.id } });
  return { admin, em, sm, chair, wh };
}

function body(o: { name?: string; em: string; sm?: string; itemId: string; qty: string; warehouseId: string; start?: number; end?: number; extra?: Record<string, unknown> }) {
  const s = o.start ?? 0;
  const e = o.end ?? s + 1;
  return {
    name: o.name ?? 'Sharma–Verma wedding', venueName: 'Palace Grounds', venueAddress: 'Bengaluru',
    startsAt: at(s, 12), endsAt: at(e, 16), leaveWarehouseAt: at(s), expectedReturnDate: dateOf(e + 1),
    eventManagerIds: [o.em], storeManagerIds: o.sm ? [o.sm] : [],
    lines: [{ itemId: o.itemId, plannedQty: o.qty, sources: [{ type: 'warehouse', warehouseId: o.warehouseId, qty: o.qty }] }],
    ...o.extra
  };
}

async function create(as: As, b: Record<string, unknown>, schedule = true) {
  const res = await createEvent(makeReq('POST', '/api/v1/events', { ...as, body: { ...b, schedule } }));
  return { res, json: await res.json() };
}

const outbox = async (trigger: string) =>
  (await getPool().query<{ record_id: string; payload: Record<string, unknown> }>('SELECT record_id, payload FROM notification_outbox WHERE trigger = $1 ORDER BY id', [trigger])).rows;

describe('create and schedule (005 US1)', () => {
  it('numbers the event, reserves 50 chairs, and lowers availability only for overlapping dates', async () => {
    const { admin, em, sm, chair, wh } = await setup();
    const { res, json } = await create(admin.as, body({ em: em.user.id, sm: sm.user.id, itemId: chair.id, qty: '50', warehouseId: wh.id }));
    expect(res.status).toBe(201);
    const ev = eventSchema.parse(json);
    expect(ev.number).toMatch(/^EVT-\d{4}-0001$/);
    expect(ev.status).toBe('scheduled');
    expect(ev.lines[0]!.sources[0]!.reservedQty).toBe('50.000');
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'reserved')).toBe('50.000');
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('50.000');

    const check = async (s: number) => (await (await availability(makeReq('POST', '/x', { ...admin.as, body: {
      leaveWarehouseAt: at(s), expectedReturnDate: dateOf(s + 1), lines: [{ itemId: chair.id, qty: '10' }]
    } }))).json()).lines[0];
    expect((await check(1)).available).toBe('50.000'); // overlaps
    expect((await check(20)).available).toBe('100.000'); // later, no overlap
    expect((await check(20)).suggestedWarehouseId).toBe(wh.id);
  });

  it('refuses to schedule with missing fields, naming each; a Draft saves anyway', async () => {
    const { admin } = await setup();
    const draft = await create(admin.as, { name: 'Just an idea' }, false);
    expect(draft.res.status).toBe(201);
    expect(draft.json.status).toBe('draft');
    const s = await scheduleEvent(makeReq('POST', '/x', { ...admin.as, body: {} }), { params: { id: draft.json.id } });
    expect(s.status).toBe(400);
    const err = (await s.json()).error;
    expect(err.code).toBe('EVENT_INCOMPLETE');
    expect(err.details.missing).toEqual(expect.arrayContaining(['venueName', 'startsAt', 'endsAt', 'leaveWarehouseAt', 'expectedReturnDate', 'eventManagerIds', 'lines']));
  });

  it('checks the date rules', async () => {
    const { admin, em, chair, wh } = await setup();
    const late = body({ em: em.user.id, itemId: chair.id, qty: '5', warehouseId: wh.id, extra: { leaveWarehouseAt: at(1, 13) } });
    expect((await create(admin.as, late)).res.status).toBe(400);
    const early = body({ em: em.user.id, itemId: chair.id, qty: '5', warehouseId: wh.id, extra: { expectedReturnDate: dateOf(0) } });
    expect((await create(admin.as, early)).res.status).toBe(400);
  });

  it('suggests the Store Managers of the line warehouses; managers see only their events', async () => {
    const { admin, em, sm, chair, wh } = await setup();
    const { json } = await create(admin.as, body({ em: em.user.id, itemId: chair.id, qty: '5', warehouseId: wh.id }));
    expect(json.suggestedStoreManagers.map((s: { id: string }) => s.id)).toEqual([sm.user.id]);
    const other = await webSessionFor(['event_manager']);
    expect((await getEvent(makeReq('GET', '/x', other.as), { params: { id: json.id } })).status).toBe(403);
    expect((await getEvent(makeReq('GET', '/x', em.as), { params: { id: json.id } })).status).toBe(200);
    const list = eventListSchema.parse(await (await listEvents(makeReq('GET', '/api/v1/events', other.as))).json());
    expect(list.items).toHaveLength(0);
  });

  it('only Admins create events', async () => {
    const { em, chair, wh } = await setup();
    expect((await create(em.as, body({ em: em.user.id, itemId: chair.id, qty: '5', warehouseId: wh.id }))).res.status).toBe(403);
  });
});

describe('over-booking (005 US2, owner decision Q4)', () => {
  it('saves with a warning sent to Admins, Event Managers and Store Managers; clears when resolved', async () => {
    const { admin, em, sm, chair, wh } = await setup('100');
    const first = await create(admin.as, body({ name: 'First', em: em.user.id, itemId: chair.id, qty: '80', warehouseId: wh.id }));
    const em2 = await webSessionFor(['event_manager']);
    const pre = await (await availability(makeReq('POST', '/x', { ...admin.as, body: {
      leaveWarehouseAt: at(1), expectedReturnDate: dateOf(3), lines: [{ itemId: chair.id, qty: '30', warehouseId: wh.id }]
    } }))).json();
    expect(pre.lines[0]).toMatchObject({ available: '20.000', required: '30.000', shortfall: '10.000' });
    expect(pre.lines[0].clashingEvents[0].id).toBe(first.json.id);

    const second = await create(admin.as, body({ name: 'Second', em: em2.user.id, sm: sm.user.id, itemId: chair.id, qty: '30', warehouseId: wh.id, start: 1 }));
    expect(second.res.status).toBe(201);
    expect(second.json.warnings).toHaveLength(1);
    expect(second.json.warnings[0]).toMatchObject({ shortfallQty: '10.000', clashingEvents: [{ id: first.json.id }] });
    const raised = await outbox('event.overbooking_raised');
    expect(raised).toHaveLength(1);
    expect(raised[0]!.payload.recipientIds).toEqual(expect.arrayContaining([admin.user.id, em2.user.id, sm.user.id]));
    // Listed on the clashing event too.
    const firstView = await (await getEvent(makeReq('GET', '/x', admin.as), { params: { id: first.json.id } })).json();
    expect(firstView.clashWarnings[0]).toMatchObject({ eventId: second.json.id, shortfallQty: '10.000' });
    const overbooked = await (await listEvents(makeReq('GET', '/api/v1/events?overbooked=true', admin.as))).json();
    expect(overbooked.items.map((e: { id: string }) => e.id)).toEqual([second.json.id]);

    // Reduce the clashing event to 60 → the warning clears and the same people are told.
    const fresh = first.json;
    const p = await patchEvent(makeReq('PATCH', '/x', { ...admin.as, headers: { 'if-match': String(fresh.version) }, body: {
      lines: [{ itemId: chair.id, plannedQty: '60', sources: [{ type: 'warehouse', warehouseId: wh.id, qty: '60' }] }]
    } }), { params: { id: fresh.id } });
    expect(p.status).toBe(200);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'reserved')).toBe('90.000');
    const after = await (await getEvent(makeReq('GET', '/x', admin.as), { params: { id: second.json.id } })).json();
    expect(after.warnings).toHaveLength(0);
    const resolved = await outbox('event.overbooking_resolved');
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.payload.recipientIds).toEqual(expect.arrayContaining([admin.user.id, em2.user.id, sm.user.id]));
  });

  it('warns on a line whose warehouse has no Store Manager on the event', async () => {
    const { admin, em, chair, wh } = await setup();
    const { json } = await create(admin.as, body({ em: em.user.id, itemId: chair.id, qty: '5', warehouseId: wh.id }));
    expect(json.linesWithoutStoreManager).toEqual([json.lines[0].id]);
  });
});

describe('assignee notifications (005 US3)', () => {
  it('notifies each assignee once on schedule; tells removed managers', async () => {
    const { admin, em, sm, chair, wh } = await setup();
    const { json } = await create(admin.as, body({ em: em.user.id, sm: sm.user.id, itemId: chair.id, qty: '5', warehouseId: wh.id }));
    const scheduled = await outbox('event.scheduled');
    expect(scheduled).toHaveLength(1);
    expect((scheduled[0]!.payload.recipientIds as string[]).sort()).toEqual([em.user.id, sm.user.id].sort());
    expect(scheduled[0]!.payload).toMatchObject({ number: json.number, name: json.name, link: `/events/${json.id}` });
    const em2 = await webSessionFor(['event_manager']);
    await patchEvent(makeReq('PATCH', '/x', { ...admin.as, headers: { 'if-match': String(json.version) }, body: { eventManagerIds: [em2.user.id], leaveWarehouseAt: at(0, 2) } }), { params: { id: json.id } });
    expect((await outbox('event.unassigned'))[0]!.payload.recipientIds).toEqual([em.user.id]);
    const changed = await outbox('event.changed');
    expect(changed[0]!.payload.changes).toEqual(expect.arrayContaining(['leaveWarehouseAt', 'eventManagers']));
    expect(changed[0]!.payload.recipientIds).toEqual(expect.arrayContaining([em2.user.id, sm.user.id]));
  });
});

describe('direct handover sourcing (clarification)', () => {
  it('sources a later event from an earlier one without a new reservation; breaking the fit raises a warning', async () => {
    const { admin, em, chair, wh } = await setup('100');
    const x = await create(admin.as, body({ name: 'Sangeet', em: em.user.id, itemId: chair.id, qty: '40', warehouseId: wh.id, start: 0, end: 0 }));
    const sources = await (await handoverSources(makeReq('GET', `/x?itemId=${chair.id}&leaveAt=${encodeURIComponent(at(1))}`, admin.as))).json();
    expect(sources.items[0]).toMatchObject({ eventId: x.json.id, freeQty: '40.000' });
    const y = await create(admin.as, {
      ...body({ name: 'Reception', em: em.user.id, itemId: chair.id, qty: '20', warehouseId: wh.id, start: 1 }),
      lines: [{ itemId: chair.id, plannedQty: '20', sources: [{ type: 'event', eventId: x.json.id, qty: '20' }] }]
    });
    expect(y.res.status).toBe(201);
    expect(y.json.lines[0].sources[0]).toMatchObject({ type: 'event', eventNumber: x.json.number, reservedQty: '0.000' });
    expect(y.json.warnings).toHaveLength(0);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'reserved')).toBe('40.000');

    const tooLate = await create(admin.as, {
      ...body({ name: 'Too early', em: em.user.id, itemId: chair.id, qty: '5', warehouseId: wh.id, start: 0 }),
      lines: [{ itemId: chair.id, plannedQty: '5', sources: [{ type: 'event', eventId: x.json.id, qty: '5' }] }]
    });
    expect(tooLate.json.error.code).toBe('HANDOVER_NOT_ELIGIBLE');

    // Cancelling X leaves Y's line unsourced → over-booking warning on Y.
    await cancelEvent(makeReq('POST', '/x', { ...admin.as, body: { reason: 'client postponed' } }), { params: { id: x.json.id } });
    const yAfter = await (await getEvent(makeReq('GET', '/x', admin.as), { params: { id: y.json.id } })).json();
    expect(yAfter.warnings[0]).toMatchObject({ sourceEventId: x.json.id, shortfallQty: '20.000' });
  });
});

describe('edit, cancel, copy (005 US4)', () => {
  it('follows quantity edits, releases on cancel, refuses cancel after dispatch', async () => {
    const { admin, em, sm, chair, wh } = await setup();
    const { json } = await create(admin.as, body({ em: em.user.id, sm: sm.user.id, itemId: chair.id, qty: '50', warehouseId: wh.id }));
    const p = await patchEvent(makeReq('PATCH', '/x', { ...admin.as, headers: { 'if-match': String(json.version) }, body: {
      lines: [{ itemId: chair.id, plannedQty: '40', sources: [{ type: 'warehouse', warehouseId: wh.id, qty: '40' }] }]
    } }), { params: { id: json.id } });
    expect(p.status).toBe(200);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'reserved')).toBe('40.000');
    const stale = await patchEvent(makeReq('PATCH', '/x', { ...admin.as, headers: { 'if-match': String(json.version) }, body: { name: 'Again' } }), { params: { id: json.id } });
    expect(stale.status).toBe(409);
    expect((await stale.json()).error).toMatchObject({ code: 'EVENT_CHANGED', details: { version: json.version + 1 } });

    const c = await cancelEvent(makeReq('POST', '/x', { ...admin.as, body: { reason: 'called off' } }), { params: { id: json.id } });
    expect(c.status).toBe(200);
    expect((await c.json()).status).toBe('cancelled');
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'reserved')).toBe('0.000');
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('100.000');
    expect((await outbox('event.cancelled'))[0]!.payload.recipientIds).toEqual(expect.arrayContaining([em.user.id, sm.user.id]));

    const again = await create(admin.as, body({ em: em.user.id, itemId: chair.id, qty: '5', warehouseId: wh.id }));
    await getPool().query("UPDATE events SET status = 'dispatching' WHERE id = $1", [again.json.id]);
    const refused = await cancelEvent(makeReq('POST', '/x', { ...admin.as, body: { reason: 'too late now' } }), { params: { id: again.json.id } });
    expect((await refused.json()).error.code).toBe('EVENT_STATE');
  });

  it('copies an event as a Draft with the same items and managers but no dates', async () => {
    const { admin, em, chair, wh } = await setup();
    const { json } = await create(admin.as, body({ em: em.user.id, itemId: chair.id, qty: '50', warehouseId: wh.id }));
    const c = await copyEvent(makeReq('POST', '/x', { ...admin.as, body: {} }), { params: { id: json.id } });
    expect(c.status).toBe(201);
    const copy = eventSchema.parse(await c.json());
    expect(copy).toMatchObject({ status: 'draft', startsAt: null, leaveWarehouseAt: null, expectedReturnDate: null, name: json.name });
    expect(copy.number).not.toBe(json.number);
    expect(copy.lines[0]).toMatchObject({ itemId: chair.id, plannedQty: '50.000' });
    expect(copy.eventManagers.map((m) => m.id)).toEqual([em.user.id]);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'reserved')).toBe('50.000');
  });
});

describe('views (005 US5)', () => {
  it('Today lists dispatches and returns due today for the Store Manager’s warehouses; calendar by month', async () => {
    const { admin, em, sm, chair, wh } = await setup();
    const now = Date.now();
    const leave = new Date(now + 60_000).toISOString();
    const b = { ...body({ em: em.user.id, itemId: chair.id, qty: '5', warehouseId: wh.id }),
      leaveWarehouseAt: leave, startsAt: new Date(now + DAY).toISOString(), endsAt: new Date(now + 2 * DAY).toISOString(), expectedReturnDate: istDate(new Date(now + 3 * DAY)) };
    const ev = await create(admin.as, b);
    const other = await warehouse(admin.as, 'NORTH');
    await opening(admin.as, [{ itemId: chair.id, locationId: other.defaultLocationId, quantity: '10' }]);
    await create(admin.as, { ...b, name: 'Elsewhere', lines: [{ itemId: chair.id, plannedQty: '5', sources: [{ type: 'warehouse', warehouseId: other.id, qty: '5' }] }] });
    const t = await (await today(makeReq('GET', '/api/v1/events/today', sm.as))).json();
    expect(t.dispatches.map((e: { id: string }) => e.id)).toEqual([ev.json.id]);
    expect(t.returns).toEqual([]);
    const month = istDate(new Date(now + DAY)).slice(0, 7);
    const cal = await (await calendar(makeReq('GET', `/api/v1/events/calendar?month=${month}`, admin.as))).json();
    expect(cal.items.length).toBeGreaterThanOrEqual(1);
  });
});

describe('reminders and checks (005 US6, SC-005)', () => {
  it('reminds Store Managers 24 h before leaving, once', async () => {
    const { admin, em, sm, chair, wh } = await setup();
    const { json } = await create(admin.as, body({ em: em.user.id, sm: sm.user.id, itemId: chair.id, qty: '5', warehouseId: wh.id }));
    const leave = Date.parse(json.leaveWarehouseAt);
    await runEventReminders(new Date(leave - 25 * 3_600_000));
    expect(await outbox('event.dispatch_reminder')).toHaveLength(0);
    await runEventReminders(new Date(leave - 24 * 3_600_000));
    await runEventReminders(new Date(leave - 23 * 3_600_000));
    const r = await outbox('event.dispatch_reminder');
    expect(r).toHaveLength(1);
    expect(r[0]!.payload.recipientIds).toEqual([sm.user.id]);
  });

  it('reservations equal the planned quantities of scheduled events', async () => {
    const { admin, em, chair, wh } = await setup();
    await create(admin.as, body({ em: em.user.id, itemId: chair.id, qty: '30', warehouseId: wh.id }));
    expect(await reservationMismatches(getPool())).toEqual([]);
  });
});
