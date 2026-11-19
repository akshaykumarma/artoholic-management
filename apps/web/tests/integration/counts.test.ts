import { describe, it, expect } from 'vitest';
import { countReviewSchema, countScheduleSchema, countSheetSchema, istDate, nextDueOnOrAfter } from '@artoholic/shared';
import { GET as listSchedules, POST as createSchedule } from '../../app/api/v1/counts/schedules/route';
import { PATCH as patchSchedule } from '../../app/api/v1/counts/schedules/[id]/route';
import { GET as listSessions, POST as adHoc } from '../../app/api/v1/counts/sessions/route';
import { GET as sheet } from '../../app/api/v1/counts/sessions/[id]/sheet/route';
import { PUT as entries } from '../../app/api/v1/counts/sessions/[id]/entries/route';
import { POST as submit } from '../../app/api/v1/counts/sessions/[id]/submit/route';
import { GET as review } from '../../app/api/v1/counts/sessions/[id]/review/route';
import { POST as approve } from '../../app/api/v1/counts/lines/[lineId]/approve/route';
import { POST as reject } from '../../app/api/v1/counts/lines/[lineId]/reject/route';
import { webSessionFor, type WebSession } from '../session-helpers';
import { basicStock, item, opening, warehouse } from '../inventory-helpers';
import { balanceOf } from '../../server/stock/balances';
import { createDueSessions, escalateOverdue } from '../../server/counts/sessions';
import { getPool } from '../../db/client';
import { makeReq } from '../request';

type As = WebSession['as'];
const today = istDate(new Date());
const plusDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** An instant at hh:mm IST on a calendar date. */
const ist = (d: string, hh: number, mm = 0) => new Date(Date.parse(`${d}T00:00:00Z`) + (hh * 60 + mm - 330) * 60_000);

async function setup() {
  const admin = await webSessionFor(['admin']);
  const sm = await webSessionFor(['store_manager']);
  const { chair, wh, cat } = await basicStock(admin.as, '40');
  const lamp = await item(admin.as, { name: 'Brass lamp', categoryId: cat, trackingType: 'counted', replacementValuePaise: 250000 });
  await opening(admin.as, [{ itemId: lamp.id, locationId: wh.defaultLocationId, quantity: '10' }]);
  return { admin, sm, chair, lamp, wh, cat };
}
const outbox = async (trigger: string) => (await getPool().query<{ payload: Record<string, unknown> }>('SELECT payload FROM notification_outbox WHERE trigger = $1 ORDER BY id', [trigger])).rows;
const getSheet = async (as: As, id: string) => {
  const res = await sheet(makeReq('GET', '/x', as), { params: { id } });
  return { status: res.status, raw: await res.json() };
};

describe('count schedules (007 US1)', () => {
  it('computes due dates, pauses and resumes without catching up', async () => {
    const { admin, sm, wh } = await setup();
    const res = await createSchedule(makeReq('POST', '/x', { ...admin.as, body: { name: 'Main monthly', frequency: 'monthly', startDate: '2027-01-31', scope: { warehouseIds: [wh.id] }, assigneeIds: [sm.user.id] } }));
    expect(res.status).toBe(201);
    const s = countScheduleSchema.parse(await res.json());
    expect(s).toMatchObject({ nextDueDate: '2027-01-31', blind: true });
    expect((await createSchedule(makeReq('POST', '/x', { ...admin.as, body: { name: 'x', frequency: 'monthly', startDate: '2027-01-31', scope: {}, assigneeIds: [admin.user.id] } }))).status).toBe(400);
    // A schedule that started in the past: pausing stops sessions; resuming skips the missed periods.
    const past = countScheduleSchema.parse(await (await createSchedule(makeReq('POST', '/x', { ...admin.as, body: { name: 'Old', frequency: 'monthly', startDate: '2025-01-31', scope: {}, assigneeIds: [sm.user.id] } }))).json());
    expect(past.nextDueDate).toBe(nextDueOnOrAfter('2025-01-31', 'monthly', today));
    await patchSchedule(makeReq('PATCH', '/x', { ...admin.as, body: { status: 'paused' } }), { params: { id: past.id } });
    expect(await createDueSessions(ist(plusDays(today, 70), 8))).toBe(0);
    await getPool().query("UPDATE count_schedules SET next_due_date = '2025-03-31' WHERE id = $1", [past.id]);
    const resumed = await (await patchSchedule(makeReq('PATCH', '/x', { ...admin.as, body: { status: 'active' } }), { params: { id: past.id } })).json();
    expect(resumed.nextDueDate).toBe(nextDueOnOrAfter('2025-01-31', 'monthly', today));
    expect((await (await listSchedules(makeReq('GET', '/x', admin.as))).json()).items).toHaveLength(2);
    expect((await listSchedules(makeReq('GET', '/x', sm.as))).status).toBe(403);
  });
});

describe('sessions (007 US2)', () => {
  it('creates exactly one session at 07:00 IST on the due date, snapshots in-bin stock, tells assignees', async () => {
    const { admin, sm, wh } = await setup();
    const s = await (await createSchedule(makeReq('POST', '/x', { ...admin.as, body: { name: 'Main monthly', frequency: 'monthly', startDate: '2027-01-31', scope: { warehouseIds: [wh.id] }, assigneeIds: [sm.user.id] } }))).json();
    expect(await createDueSessions(new Date('2027-01-31T01:00:00Z'))).toBe(0); // 06:30 IST
    expect(await createDueSessions(new Date('2027-01-31T01:31:00Z'))).toBe(1);
    expect(await createDueSessions(new Date('2027-01-31T02:00:00Z'))).toBe(0);
    const { rows } = await getPool().query('SELECT number, due_date::text AS due FROM count_sessions');
    expect(rows).toEqual([{ number: expect.stringMatching(/^CNT-\d{4}-0001$/), due: '2027-01-31' }]);
    expect((await getPool().query('SELECT next_due_date::text AS d FROM count_schedules WHERE id = $1', [s.id])).rows[0].d).toBe('2027-02-28');
    expect((await outbox('count.due'))[0]!.payload.recipientIds).toEqual([sm.user.id]);
    const list = (await (await listSessions(makeReq('GET', '/x', sm.as))).json()).items;
    expect(list[0]).toMatchObject({ lineCount: 2, countedCount: 0 });
  });

  it('ad-hoc counts are limited to the chosen category and skip deactivated warehouses', async () => {
    const { admin, sm, wh, cat } = await setup();
    const other = await warehouse(admin.as, 'OLD');
    await getPool().query("UPDATE warehouses SET status = 'archived' WHERE id = $1", [other.id]);
    const res = await adHoc(makeReq('POST', '/x', { ...admin.as, body: { scope: { warehouseIds: [wh.id, other.id], categoryIds: [cat] }, assigneeIds: [sm.user.id] } }));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect((await getPool().query('SELECT notes FROM count_sessions WHERE id = $1', [id])).rows[0].notes).toContain('OLD');
  });
});

describe('counting and review (007 US3, US4)', () => {
  it('blind sheet, found item, uncounted confirm, variances in ₹, approve/reject, recount, completion', async () => {
    const { admin, sm, chair, lamp, wh } = await setup();
    const { id } = await (await adHoc(makeReq('POST', '/x', { ...admin.as, body: { scope: { warehouseIds: [wh.id] }, assigneeIds: [sm.user.id] } }))).json();
    const other = await webSessionFor(['store_manager']);
    expect((await getSheet(other.as, id)).status).toBe(403);
    const { raw } = await getSheet(sm.as, id);
    expect(JSON.stringify(raw)).not.toContain('recordedQty');
    const sh = countSheetSchema.parse(raw);
    expect(sh.canCount).toBe(true);
    const chairLine = sh.lines.find((l) => l.itemId === chair.id)!;
    const lampLine = sh.lines.find((l) => l.itemId === lamp.id)!;
    expect((await getSheet(admin.as, id)).raw.lines[0].recordedQty).toBeDefined();

    // Save part-way, then add an item found in a bin where the record has none (US3-2).
    const cat2 = (await getPool().query('SELECT category_id FROM items WHERE id = $1', [chair.id])).rows[0].category_id;
    const table = await item(admin.as, { name: 'Round table', categoryId: cat2, trackingType: 'counted' });
    expect((await entries(makeReq('PUT', '/x', { ...sm.as, body: { entries: [{ lineId: chairLine.id, countedQty: '37' }, { itemId: table.id, locationId: wh.defaultLocationId, countedQty: '2', note: 'found behind racks' }] } }), { params: { id } })).status).toBe(200);
    const uncounted = await submit(makeReq('POST', '/x', { ...sm.as, body: {} }), { params: { id } });
    expect((await uncounted.json()).error.code).toBe('UNCOUNTED_LINES');
    await entries(makeReq('PUT', '/x', { ...sm.as, body: { entries: [{ lineId: lampLine.id, countedQty: '12' }] } }), { params: { id } });
    expect((await submit(makeReq('POST', '/x', { ...sm.as, body: {} }), { params: { id } })).status).toBe(200);
    expect((await outbox('count.submitted'))[0]!.payload.recipientIds).toContain(admin.user.id);

    // Review: variance −3 chairs (₹1,500 each), +2 lamps (₹2,500 each), +2 tables found; sorted by ₹ impact.
    expect((await review(makeReq('GET', '/x', sm.as), { params: { id } })).status).toBe(403);
    const rv = countReviewSchema.parse(await (await review(makeReq('GET', '/x', admin.as), { params: { id } })).json());
    const chairR = rv.lines.find((l) => l.itemId === chair.id)!;
    const lampR = rv.lines.find((l) => l.itemId === lamp.id)!;
    expect(chairR).toMatchObject({ recordedQty: '40.000', countedQty: '37.000', varianceQty: '-3.000', variancePaise: -150000, decision: 'pending' });
    expect(lampR).toMatchObject({ varianceQty: '2.000', variancePaise: 500000 });
    expect(rv.lines[0]!.itemId).toBe(lamp.id);

    expect((await approve(makeReq('POST', '/x', { ...admin.as, body: { reason: 'confirmed missing' } }), { params: { lineId: chairR.id } })).status).toBe(200);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('37.000');
    const { rows: mv } = await getPool().query("SELECT reference_type, quantity::text AS q FROM stock_movements WHERE type = 'adjustment' ORDER BY id DESC LIMIT 1");
    expect(mv[0]).toMatchObject({ reference_type: 'count_line', q: '3.000' });
    expect((await reject(makeReq('POST', '/x', { ...admin.as, body: { reason: 'recount the lamps' } }), { params: { lineId: lampR.id } })).status).toBe(200);
    expect((await outbox('count.recount'))[0]!.payload.recipientIds).toEqual([sm.user.id]);

    // Recount: lamps are 10 after all → matched; approve the found tables → completed.
    const again = countSheetSchema.parse((await getSheet(sm.as, id)).raw);
    expect(again.status).toBe('open');
    expect(again.lines.find((l) => l.id === lampR.id)!.decision).toBe('recount');
    await entries(makeReq('PUT', '/x', { ...sm.as, body: { entries: [{ lineId: lampR.id, countedQty: '10' }] } }), { params: { id } });
    expect((await entries(makeReq('PUT', '/x', { ...sm.as, body: { entries: [{ lineId: chairR.id, countedQty: '1' }] } }), { params: { id } })).status).toBe(400);
    await submit(makeReq('POST', '/x', { ...sm.as, body: {} }), { params: { id } });
    const rv2 = countReviewSchema.parse(await (await review(makeReq('GET', '/x', admin.as), { params: { id } })).json());
    expect(rv2.lines.find((l) => l.id === lampR.id)!.decision).toBe('matched');
    const tableR = rv2.lines.find((l) => l.itemId === table.id)!;
    expect(tableR).toMatchObject({ addedByCounter: true, varianceQty: '2.000' });
    await approve(makeReq('POST', '/x', { ...admin.as, body: { reason: 'found stock' } }), { params: { lineId: tableR.id } });
    expect(await balanceOf(table.id, wh.defaultLocationId, 'available')).toBe('2.000');
    expect((await getPool().query('SELECT status FROM count_sessions WHERE id = $1', [id])).rows[0].status).toBe('completed');
  });

  it('ignores stock that moved after the snapshot, and refuses an adjustment that would go below zero', async () => {
    const { admin, sm, chair, wh } = await setup();
    const { id } = await (await adHoc(makeReq('POST', '/x', { ...admin.as, body: { scope: { warehouseIds: [wh.id] }, assigneeIds: [sm.user.id] } }))).json();
    const sh = countSheetSchema.parse((await getSheet(sm.as, id)).raw);
    const line = sh.lines.find((l) => l.itemId === chair.id)!;
    await entries(makeReq('PUT', '/x', { ...sm.as, body: { entries: sh.lines.map((l) => ({ lineId: l.id, countedQty: l.id === line.id ? '35' : '10' })) } }), { params: { id } });
    await submit(makeReq('POST', '/x', { ...sm.as, body: {} }), { params: { id } });
    // After counting, 5 more chairs arrive (opening stock), so 45 are on record now.
    await opening(admin.as, [{ itemId: chair.id, locationId: wh.defaultLocationId, quantity: '5' }]);
    await approve(makeReq('POST', '/x', { ...admin.as, body: { reason: 'confirmed' } }), { params: { lineId: line.id } });
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe('40.000'); // 45 − 5, not 35

    // A second count: record 40, count 10; then 35 leave → approving −30 would go below zero.
    const { id: id2 } = await (await adHoc(makeReq('POST', '/x', { ...admin.as, body: { scope: { warehouseIds: [wh.id] }, assigneeIds: [sm.user.id] } }))).json();
    const sh2 = countSheetSchema.parse((await getSheet(sm.as, id2)).raw);
    const l2 = sh2.lines.find((l) => l.itemId === chair.id)!;
    await entries(makeReq('PUT', '/x', { ...sm.as, body: { entries: sh2.lines.map((l) => ({ lineId: l.id, countedQty: '10' })) } }), { params: { id: id2 } });
    await submit(makeReq('POST', '/x', { ...sm.as, body: {} }), { params: { id: id2 } });
    const { postMovements } = await import('../../server/stock/post');
    const { withTransaction } = await import('../../db/client');
    await withTransaction((tx) => postMovements(tx, [{ type: 'write_off', itemId: chair.id, quantity: '35', from: { locationId: wh.defaultLocationId, condition: 'available' }, to: { condition: 'written_off' } }], { actorUserId: admin.user.id }));
    const neg = await approve(makeReq('POST', '/x', { ...admin.as, body: { reason: 'confirmed' } }), { params: { lineId: l2.id } });
    expect((await neg.json()).error.code).toBe('ADJUSTMENT_NEGATIVE');
    expect((await getPool().query('SELECT decision FROM count_lines WHERE id = $1', [l2.id])).rows[0].decision).toBe('recount');
  });
});

describe('escalation (007 US5)', () => {
  it('tells Admins daily once a session is 3 days overdue', async () => {
    const { admin, sm, wh } = await setup();
    await adHoc(makeReq('POST', '/x', { ...admin.as, body: { scope: { warehouseIds: [wh.id] }, assigneeIds: [sm.user.id] } }));
    expect(await escalateOverdue(ist(plusDays(today, 2), 9))).toBe(0);
    expect(await escalateOverdue(ist(plusDays(today, 3), 6, 30))).toBe(0); // before 07:00 IST
    expect(await escalateOverdue(ist(plusDays(today, 3), 7, 5))).toBe(1);
    expect(await escalateOverdue(ist(plusDays(today, 3), 15))).toBe(0);
    expect(await escalateOverdue(ist(plusDays(today, 4), 7, 5))).toBe(1);
    expect((await outbox('count.overdue'))[0]!.payload.recipientIds).toContain(admin.user.id);
  });
});
