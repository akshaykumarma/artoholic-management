import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { dashboardSchema, istDate, reportResultSchema, roundsSchema, stepSchema } from '@artoholic/shared';
import { GET as registry } from '../../app/api/v1/reports/route';
import { POST as run } from '../../app/api/v1/reports/[reportId]/run/route';
import { POST as exportRoute } from '../../app/api/v1/reports/[reportId]/export/route';
import { GET as download } from '../../app/api/v1/reports/runs/[runId]/download/route';
import { POST as createSchedule } from '../../app/api/v1/report-schedules/route';
import { GET as scheduleRuns } from '../../app/api/v1/report-schedules/[id]/runs/route';
import { GET as dash } from '../../app/api/v1/dashboard/route';
import { POST as createEvent } from '../../app/api/v1/events/route';
import { GET as rounds } from '../../app/api/v1/events/[id]/rounds/route';
import { GET as getStep } from '../../app/api/v1/events/[id]/steps/[stepId]/route';
import { POST as submit } from '../../app/api/v1/events/[id]/steps/[stepId]/submit/route';
import { POST as adHoc } from '../../app/api/v1/counts/sessions/route';
import { GET as sheet } from '../../app/api/v1/counts/sessions/[id]/sheet/route';
import { PUT as entries } from '../../app/api/v1/counts/sessions/[id]/entries/route';
import { POST as submitCount } from '../../app/api/v1/counts/sessions/[id]/submit/route';
import { PATCH as patchWh } from '../../app/api/v1/warehouses/[id]/route';
import { webSessionFor, type WebSession } from '../session-helpers';
import { basicStock, opening, warehouse } from '../inventory-helpers';
import { runDueSchedules, runsOn } from '../../server/reports/schedules';
import { toXlsx } from '../../server/reports/xlsx';
import { processOutbox } from '../../server/notifications/dispatcher';
import { processJobs } from '../../server/notifications/sender';
import { REPORTS } from '@artoholic/shared';
import { getPool } from '../../db/client';
import { makeReq } from '../request';

type As = WebSession['as'];
const DAY = 86_400_000;

/** Seeded fixture (T004): MAIN 100 chairs, NORTH 20; an event of 30 dispatched, 29 received + 1 missing; a count with −2. */
async function seed() {
  const admin = await webSessionFor(['admin']);
  const sm = await webSessionFor(['store_manager']);
  const em = await webSessionFor(['event_manager']);
  const { chair, wh } = await basicStock(admin.as, '100');
  const north = await warehouse(admin.as, 'NORTH');
  await opening(admin.as, [{ itemId: chair.id, locationId: north.defaultLocationId, quantity: '20' }]);
  await patchWh(makeReq('PATCH', '/x', { ...admin.as, body: { storeManagerIds: [sm.user.id] } }), { params: { id: wh.id } });
  const t = Date.now();
  const ev = await (await createEvent(makeReq('POST', '/x', { ...admin.as, body: {
    name: 'Gala', venueName: 'Leela', startsAt: new Date(t + 2 * DAY).toISOString(), endsAt: new Date(t + 2 * DAY + 3600_000).toISOString(),
    leaveWarehouseAt: new Date(t + DAY).toISOString(), expectedReturnDate: istDate(new Date(t + 3 * DAY)), eventManagerIds: [em.user.id], storeManagerIds: [sm.user.id], schedule: true,
    lines: [{ itemId: chair.id, plannedQty: '30', sources: [{ type: 'warehouse', warehouseId: wh.id, qty: '30' }] }]
  } }))).json();
  const r = roundsSchema.parse(await (await rounds(makeReq('GET', '/x', admin.as), { params: { id: ev.id } })).json());
  const go = async (as: As, type: string, entry: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    const sid = r.rounds[0]!.steps.find((s) => s.step === type)!.id;
    const st = stepSchema.parse(await (await getStep(makeReq('GET', '/x', as), { params: { id: ev.id, stepId: sid } })).json());
    expect((await submit(makeReq('POST', '/x', { ...as, body: { version: st.version, entries: st.rows.map((x) => ({ entryId: x.entryId, ...entry })), ...extra } }), { params: { id: ev.id, stepId: sid } })).status).toBe(200);
  };
  await go(sm.as, 'warehouse_dispatch', { dispatched: '30' });
  await go(em.as, 'site_receipt', { received: '29' }, { confirmMissing: true });
  const { id: countId } = await (await adHoc(makeReq('POST', '/x', { ...admin.as, body: { scope: { warehouseIds: [wh.id] }, assigneeIds: [sm.user.id] } }))).json();
  const sh = await (await sheet(makeReq('GET', '/x', sm.as), { params: { id: countId } })).json();
  await entries(makeReq('PUT', '/x', { ...sm.as, body: { entries: sh.lines.map((l: { id: string }) => ({ lineId: l.id, countedQty: '68' })) } }), { params: { id: countId } });
  await submitCount(makeReq('POST', '/x', { ...sm.as, body: {} }), { params: { id: countId } });
  return { admin, sm, em, chair, wh, north, ev };
}
const runR = async (as: As, id: string, filters: Record<string, unknown> = {}) => {
  const res = await run(makeReq('POST', '/x', { ...as, body: { filters } }), { params: { reportId: id } });
  return { status: res.status, body: res.status === 200 ? reportResultSchema.parse(await res.json()) : await res.json() };
};

describe('reports on demand (009 US1)', () => {
  it('runs every report; R1 values stock and respects Store Manager scope', async () => {
    const { admin, sm, em } = await seed();
    expect((await (await registry(makeReq('GET', '/x', admin.as))).json()).items).toHaveLength(10);
    for (const id of Object.keys(REPORTS)) expect((await runR(admin.as, id)).status).toBe(200);

    const all = (await runR(admin.as, 'R1')).body;
    const main = all.rows.find((r: Record<string, unknown>) => r.warehouse === 'MAIN')!;
    expect(main).toMatchObject({ available: '70.000', reserved: '0.000', value: 70 * 50000 });
    expect(all.rows.find((r: Record<string, unknown>) => r.warehouse === 'At events')).toMatchObject({ out: '30.000' });
    expect(all.rows.some((r: Record<string, unknown>) => r.warehouse === 'NORTH')).toBe(true);
    const mine = (await runR(sm.as, 'R1')).body;
    expect(mine.rows.every((r: Record<string, unknown>) => r.warehouse !== 'NORTH')).toBe(true);

    const r3 = (await runR(em.as, 'R3')).body;
    expect(r3.rows[0]).toMatchObject({ event: expect.stringMatching(/^EVT-/), planned: '30.000', dispatched: '30.000', received: '29.000', gap: '30.000' });
    const r4 = (await runR(admin.as, 'R4')).body;
    expect(r4.rows[0]).toMatchObject({ kind: 'missing', quantity: '1.000', value: 50000, decision: 'pending' });
    const r5 = (await runR(admin.as, 'R5')).body.rows.map((r: Record<string, unknown>) => r.type);
    expect(r5).toEqual(expect.arrayContaining(['Damage report', 'Count variance']));
    const r6 = (await runR(admin.as, 'R6')).body.rows;
    expect(r6.map((r: Record<string, unknown>) => r.kind)).toContain('Return');
    const r7 = (await runR(admin.as, 'R7')).body.rows;
    expect(r7[0]).toMatchObject({ recorded: '70.000', counted: '68.000', variance: '-2.000', value: -100000 });
    const r10 = (await runR(em.as, 'R10')).body.rows;
    expect(r10).toHaveLength(1);
    expect((await runR(admin.as, 'R2', { warehouseId: undefined })).body.total).toBeGreaterThan(3);
  });

  it('exports Excel with title, filters, IST time, numeric money and quantities', async () => {
    const { admin } = await seed();
    const res = await exportRoute(makeReq('POST', '/x', { ...admin.as, body: { filters: {} } }), { params: { reportId: 'R1' } });
    expect(res.status).toBe(202);
    const { runId } = await res.json();
    const file = await download(makeReq('GET', '/x', admin.as), { params: { runId } });
    expect(file.headers.get('content-type')).toContain('spreadsheetml');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0]!;
    expect(ws.getCell('A1').value).toBe('Stock on hand');
    expect(String(ws.getCell('A3').value)).toMatch(/^Generated \d{2}-\d{2}-\d{4} \d{2}:\d{2} IST$/);
    expect(ws.getRow(5).getCell(10).value).toBe('Value (₹)');
    expect(typeof ws.getRow(6).getCell(6).value).toBe('number');
    expect(ws.getColumn(10).numFmt).toContain('₹');
    const empty = new ExcelJS.Workbook();
    await empty.xlsx.load(new Uint8Array(await toXlsx(REPORTS.R4, [], '')).buffer as ArrayBuffer);
    expect(empty.worksheets[0]!.getCell('A6').value).toBe('No data for this period');
  });
});

describe('scheduled reports (009 US2)', () => {
  it('Admins only; runs once a day; delivers the file by WhatsApp and email; drops deactivated recipients', async () => {
    const { admin, sm } = await seed();
    const admin2 = await webSessionFor(['admin']);
    await getPool().query("UPDATE users SET phone_e164 = '+919811000001', email = 'a@example.com' WHERE id = $1", [admin.user.id]);
    await getPool().query("INSERT INTO template_mappings (trigger, channel, template_name) VALUES ('report.ready', 'whatsapp', 'report_ready')");
    const body = { reportId: 'R5', name: 'Pending approvals', frequency: 'daily', timeIst: '00:00', recipientIds: [admin.user.id, sm.user.id] };
    const bad = await createSchedule(makeReq('POST', '/x', { ...admin.as, body }));
    expect((await bad.json()).error.code).toBe('RECIPIENT_NOT_ADMIN');
    expect((await createSchedule(makeReq('POST', '/x', { ...sm.as, body: { ...body, recipientIds: [admin.user.id] } }))).status).toBe(403);
    const s = await (await createSchedule(makeReq('POST', '/x', { ...admin.as, body: { ...body, recipientIds: [admin.user.id, admin2.user.id] } }))).json();
    await getPool().query("UPDATE users SET status = 'deactivated' WHERE id = $1", [admin2.user.id]);
    expect(await runDueSchedules()).toBe(1);
    expect(await runDueSchedules()).toBe(0);
    const removed = (await getPool().query("SELECT payload FROM notification_outbox WHERE trigger = 'report.recipient_removed'")).rows[0].payload;
    expect(removed.recipientIds).toEqual([admin.user.id]);
    await processOutbox();
    await processJobs();
    const out = (await getPool().query('SELECT channel, body FROM dev_outbox ORDER BY id')).rows;
    expect(out.find((o) => o.channel === 'whatsapp')!.body).toContain('[document: Pending-approvals-');
    expect(out.find((o) => o.channel === 'email')!.body).toContain('[attachment: Pending-approvals-');
    const runs = (await (await scheduleRuns(makeReq('GET', '/x', admin.as), { params: { id: s.id } })).json()).items;
    expect(runs[0]).toMatchObject({ status: 'succeeded' });
    expect(runs[0].deliveries.map((d: { channel: string }) => d.channel).sort()).toEqual(['email', 'whatsapp']);
  });

  it('monthly on the 31st runs on the last day of shorter months; weekly on its weekday', () => {
    const m = { frequency: 'monthly', weekday: null, month_day: 31 };
    expect(runsOn(m, '2027-02-28')).toBe(true);
    expect(runsOn(m, '2027-02-27')).toBe(false);
    expect(runsOn(m, '2027-03-31')).toBe(true);
    expect(runsOn({ frequency: 'weekly', weekday: 1, month_day: null }, '2026-11-23')).toBe(true); // Monday
    expect(runsOn({ frequency: 'weekly', weekday: 1, month_day: null }, '2026-11-24')).toBe(false);
  });

  it('a run still generating makes the next one wait', async () => {
    const { admin } = await seed();
    const s = await (await createSchedule(makeReq('POST', '/x', { ...admin.as, body: { reportId: 'R1', name: 'Stock', frequency: 'daily', timeIst: '00:00', recipientIds: [admin.user.id] } }))).json();
    await getPool().query("INSERT INTO report_runs (report_id, schedule_id, run_date, status) VALUES ('R1', $1, '2000-01-01', 'running')", [s.id]);
    expect(await runDueSchedules()).toBe(0);
  });
});

describe('dashboard (009 US3)', () => {
  it('counts pending approvals, events and stock for Admins only', async () => {
    const { admin, sm } = await seed();
    const d = dashboardSchema.parse(await (await dash(makeReq('GET', '/x', admin.as))).json());
    expect(d.pendingApprovals).toMatchObject({ damage: 1, variances: 1 });
    expect(d.eventsByStatus.at_site).toBe(1);
    expect(d.week.returns).toBe(1);
    expect((await dash(makeReq('GET', '/x', sm.as))).status).toBe(403);
  });
});

describe('performance (009 T017, SC)', () => {
  it('a 5,000-row ledger shows its first page within 5 s and exports within 30 s', async () => {
    const { admin, chair, wh } = await seed();
    await getPool().query(
      `INSERT INTO stock_movements (type, item_id, quantity, to_location_id, to_condition, actor_user_id, reason)
       SELECT 'adjustment', $1, 1, $2, 'available', $3, 'perf ' || g FROM generate_series(1, 5000) g`, [chair.id, wh.defaultLocationId, admin.user.id]
    );
    let t0 = Date.now();
    const first = (await runR(admin.as, 'R2')).body;
    expect(first.total).toBeGreaterThanOrEqual(5000);
    expect(first.rows).toHaveLength(100);
    expect(Date.now() - t0).toBeLessThan(5000);
    t0 = Date.now();
    expect((await exportRoute(makeReq('POST', '/x', { ...admin.as, body: { filters: {} } }), { params: { reportId: 'R2' } })).status).toBe(202);
    expect(Date.now() - t0).toBeLessThan(30000);
  });
});
