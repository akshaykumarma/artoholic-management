import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { GET as audit } from '../../app/api/v1/admin/audit/route';
import { POST as auditExport } from '../../app/api/v1/admin/audit/export/route';
import { GET as sessions } from '../../app/api/v1/admin/activity/sessions/route';
import { POST as endSession } from '../../app/api/v1/admin/activity/sessions/[id]/end/route';
import { GET as signIns } from '../../app/api/v1/admin/activity/sign-ins/route';
import { GET as getProfile, PUT as putProfile } from '../../app/api/v1/admin/company-profile/route';
import { GET as getList, POST as addList, PATCH as patchList } from '../../app/api/v1/admin/lists/[list]/route';
import { POST as restoreTest } from '../../app/api/v1/admin/restore-tests/route';
import { GET as backups } from '../../app/api/v1/admin/backups/route';
import { GET as retention } from '../../app/api/v1/admin/retention/route';
import { GET as status } from '../../app/api/v1/admin/status/route';
import { GET as me } from '../../app/api/v1/me/route';
import { POST as importUpload } from '../../app/api/v1/imports/route';
import { POST as importCommit } from '../../app/api/v1/imports/[id]/commit/route';
import { PATCH as patchItem, GET as getItem } from '../../app/api/v1/catalogue/items/[id]/route';
import { POST as createEvent } from '../../app/api/v1/events/route';
import { webSessionFor, mobileTokenFor } from '../session-helpers';
import { basicStock } from '../inventory-helpers';
import { runBackup, remindRestoreTest } from '../../server/admin/backups';
import { archiveAudit, purgeDamagePhotos, rollUpLedger } from '../../server/admin/retention';
import { rebuildMismatches, balanceOf } from '../../server/stock/balances';
import { memoryStorage } from '../../server/storage';
import { getPool } from '../../db/client';
import { makeReq } from '../request';

const outbox = async (trigger: string) => (await getPool().query<{ payload: Record<string, unknown> }>('SELECT payload FROM notification_outbox WHERE trigger = $1', [trigger])).rows;

describe('audit log (010 US1)', () => {
  it('finds an item edit with before/after; Admins can view and export but not change; no edit path', async () => {
    const admin = await webSessionFor(['admin']);
    const sm = await webSessionFor(['store_manager']);
    const { chair } = await basicStock(admin.as);
    const item = await (await getItem(makeReq('GET', '/x', admin.as), { params: { id: chair.id } })).json();
    await patchItem(makeReq('PATCH', '/x', { ...admin.as, headers: { 'if-match': item.item.updatedAt }, body: { replacementValuePaise: 175000 } }), { params: { id: chair.id } });
    const res = await (await audit(makeReq('GET', `/x?entityType=item&entityId=${chair.id}&action=item.updated`, admin.as))).json();
    expect(res.items).toHaveLength(1);
    expect(res.items[0].before.replacementValuePaise).toBe(50000);
    expect(res.items[0].after.replacementValuePaise).toBe(175000);
    expect((await audit(makeReq('GET', '/x', sm.as))).status).toBe(403);
    const x = await auditExport(makeReq('POST', '/x', { ...admin.as, body: { entityId: chair.id } }));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await x.arrayBuffer());
    expect(wb.worksheets[0]!.getCell('A1').value).toBe('Audit log');
    await expect(getPool().query("UPDATE audit_entries SET action = 'x'")).rejects.toThrow();
  });

  it('searches 500,000 entries by user and date within 3 seconds', async () => {
    const admin = await webSessionFor(['admin']);
    const other = await webSessionFor(['event_manager']);
    await getPool().query(
      `INSERT INTO audit_entries (occurred_at, actor_user_id, action, entity_type, entity_id)
       SELECT now() - (g || ' minutes')::interval, CASE WHEN g % 50 = 0 THEN $1::uuid ELSE $2::uuid END, 'stock.moved', 'item', g::text FROM generate_series(1, 500000) g`,
      [admin.user.id, other.user.id]
    );
    await getPool().query('ANALYZE audit_entries');
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    const t0 = Date.now();
    const r = await (await audit(makeReq('GET', `/x?actorId=${admin.user.id}&from=${today}&to=${today}`, admin.as))).json();
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(r.items.length).toBeGreaterThan(0);
  }, 60_000);
});

describe('login and activity (010 US2)', () => {
  it('ending one phone session signs out that phone only', async () => {
    const sa = await webSessionFor(['super_admin']);
    const em = await webSessionFor(['event_manager']);
    const t1 = await mobileTokenFor(em.user.username, em.user.password);
    const t2 = await mobileTokenFor(em.user.username, em.user.password);
    const list = (await (await sessions(makeReq('GET', `/x?userId=${em.user.id}`, sa.as))).json()).items;
    const phones = list.filter((s: { platform: string }) => s.platform === 'android');
    expect(phones).toHaveLength(2);
    const { rows } = await getPool().query("SELECT id FROM sessions WHERE user_id = $1 AND client_platform = 'android' ORDER BY created_at LIMIT 1", [em.user.id]);
    expect((await endSession(makeReq('POST', '/x', { ...sa.as, body: {} }), { params: { id: rows[0].id } })).status).toBe(200);
    const r1 = await me(makeReq('GET', '/x', { platform: 'android', bearer: t1 }));
    const r2 = await me(makeReq('GET', '/x', { platform: 'android', bearer: t2 }));
    expect([r1.status, r2.status].sort()).toEqual([200, 401]);
    const ins = (await (await signIns(makeReq('GET', `/x?userId=${em.user.id}`, sa.as))).json()).items;
    expect(ins.filter((i: { result: string }) => i.result === 'success').length).toBeGreaterThanOrEqual(3);
    expect((await sessions(makeReq('GET', '/x', em.as))).status).toBe(403);
  });
});

describe('company profile and master lists (010 US3)', () => {
  it('validates GSTIN, Super Admin only; values in use can only be archived', async () => {
    const sa = await webSessionFor(['super_admin']);
    const admin = await webSessionFor(['admin']);
    expect((await putProfile(makeReq('PUT', '/x', { ...sa.as, body: { gstin: 'NOTAGSTIN' } }))).status).toBe(400);
    expect((await putProfile(makeReq('PUT', '/x', { ...sa.as, body: { name: 'Artoholic Events', gstin: '29abcde1234f1z5', address: 'Bengaluru' } }))).status).toBe(200);
    expect((await (await getProfile(makeReq('GET', '/x', admin.as))).json())).toMatchObject({ name: 'Artoholic Events', gstin: '29ABCDE1234F1Z5' });
    expect((await putProfile(makeReq('PUT', '/x', { ...admin.as, body: { name: 'x' } }))).status).toBe(403);

    const em = await webSessionFor(['event_manager']);
    const types = (await (await getList(makeReq('GET', '/x', sa.as), { params: { list: 'event_type' } })).json()).items;
    await createEvent(makeReq('POST', '/x', { ...sa.as, body: { name: 'Wedding draft', typeId: types[0].id, eventManagerIds: [em.user.id] } }));
    const inUse = (await (await getList(makeReq('GET', '/x', sa.as), { params: { list: 'event_type' } })).json()).items.find((t: { id: string }) => t.id === types[0].id);
    expect(inUse.inUse).toBe(true);
    expect((await patchList(makeReq('PATCH', '/x', { ...sa.as, body: { id: inUse.id, delete: true } }), { params: { list: 'event_type' } })).status).toBe(400);
    expect((await patchList(makeReq('PATCH', '/x', { ...sa.as, body: { id: inUse.id, status: 'archived' } }), { params: { list: 'event_type' } })).status).toBe(200);
    const added = (await (await addList(makeReq('POST', '/x', { ...sa.as, body: { value: 'Water damage' } }), { params: { list: 'damage_reason' } })).json()).items;
    const w = added.find((v: { value: string }) => v.value === 'Water damage');
    expect((await patchList(makeReq('PATCH', '/x', { ...sa.as, body: { id: w.id, delete: true } }), { params: { list: 'damage_reason' } })).status).toBe(200);
  });
});

describe('import centre (010 US4)', () => {
  const upload = async (as: { cookies: Record<string, string>; csrf: string }, kind: string, csv: string) => {
    const form = new FormData();
    form.set('kind', kind);
    form.set('file', new File([csv], `${kind}.csv`, { type: 'text/csv' }));
    const headers = new Headers({ 'x-client-platform': 'web', 'x-client-version': '1.0.0', 'x-csrf-token': as.csrf, cookie: Object.entries(as.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ') });
    return importUpload(new Request('http://localhost/api/v1/imports', { method: 'POST', body: form, headers }));
  };
  it('users: nothing saved while rows have errors unless they are excluded; each created user is audited with the import', async () => {
    const admin = await webSessionFor(['admin']);
    const csv = 'full_name,phone,email,username,roles,temporary_password\nRavi Kumar,9845012345,ravi@example.com,ravi,store_manager,marigold-tent-42\nBad Row,123,,,,short\n';
    const p = await (await upload(admin.as, 'users', csv)).json();
    expect(p).toMatchObject({ totalRows: 2, validRows: 1 });
    expect(p.errors[0].row).toBe(3);
    expect((await importCommit(makeReq('POST', '/x', { ...admin.as, body: {} }), { params: { id: p.id } })).status).toBe(409);
    expect((await getPool().query("SELECT 1 FROM users WHERE username = 'ravi'")).rowCount).toBe(0);
    const ok = await importCommit(makeReq('POST', '/x', { ...admin.as, body: { excludeErrors: true } }), { params: { id: p.id } });
    expect((await ok.json()).committed).toBe(1);
    const { rows } = await getPool().query("SELECT a.after FROM audit_entries a JOIN users u ON u.id::text = a.entity_id WHERE a.action = 'import.row_created' AND u.username = 'ravi'");
    expect(rows[0].after.importBatchId).toBe(p.id);
  });

  it('categories and locations import through their own rules', async () => {
    const admin = await webSessionFor(['admin']);
    const c = await (await upload(admin.as, 'categories', 'name,parent\nLighting,\nFairy lights,Lighting\n')).json();
    expect(c.errors).toEqual([]);
    expect((await importCommit(makeReq('POST', '/x', { ...admin.as, body: {} }), { params: { id: c.id } })).status).toBe(200);
    expect((await getPool().query("SELECT p.name FROM categories c JOIN categories p ON p.id = c.parent_id WHERE c.name = 'Fairy lights'")).rows[0].name).toBe('Lighting');
    const { wh } = await basicStock(admin.as);
    await getPool().query("INSERT INTO warehouse_levels (warehouse_id, position, name) VALUES ($1, 1, 'Aisle')", [wh.id]);
    const l = await (await upload(admin.as, 'locations', 'warehouse_code,parent_code,segment\nMAIN,,A\nNOPE,,B\n')).json();
    expect(l.errors).toHaveLength(1);
    await importCommit(makeReq('POST', '/x', { ...admin.as, body: { excludeErrors: true } }), { params: { id: l.id } });
    expect((await getPool().query("SELECT 1 FROM locations WHERE code = 'MAIN-A'")).rowCount).toBe(1);
  });
});

describe('backups (010 US5)', () => {
  it('records success, alerts the Super Admin on failure, and reminds after 100 days without a restore test', async () => {
    const sa = await webSessionFor(['super_admin']);
    expect((await runBackup('echo \'{"databaseBytes": 1048576, "filesSynced": 42, "location": "s3://backups/2026-11-20"}\'')).status).toBe('succeeded');
    expect((await runBackup('exit 3')).status).toBe('failed');
    expect((await outbox('backup.failed'))[0]!.payload.recipientIds).toEqual([sa.user.id]);
    const b = await (await backups(makeReq('GET', '/x', sa.as))).json();
    expect(b.backups.map((x: { status: string }) => x.status)).toEqual(['failed', 'succeeded']);
    expect(await remindRestoreTest()).toBe(true);
    expect(await remindRestoreTest()).toBe(false);
    expect((await restoreTest(makeReq('POST', '/x', { ...sa.as, body: { performedAt: new Date().toISOString(), result: 'passed', rpoHours: 24, rtoHours: 2, notes: 'Restored into scratch DB' } }))).status).toBe(201);
    expect(await remindRestoreTest(new Date(Date.now() + 2 * 86_400_000))).toBe(false);
  });
});

describe('retention (010 US6)', () => {
  async function damagePhoto(eventStatus: string, deleteAfter: Date) {
    const sa = await getPool().query("SELECT id FROM users LIMIT 1");
    const by = sa.rows[0].id;
    const { rows: it } = await getPool().query("SELECT id FROM items LIMIT 1");
    const ev = (await getPool().query("INSERT INTO events (number, name, status, created_by) VALUES ('EVT-T-' || gen_random_uuid(), 'x', $1, $2) RETURNING id", [eventStatus, by])).rows[0].id;
    const line = (await getPool().query('INSERT INTO event_lines (event_id, item_id, planned_qty) VALUES ($1, $2, 1) RETURNING id', [ev, it[0].id])).rows[0].id;
    const wh = (await getPool().query('SELECT id FROM warehouses LIMIT 1')).rows[0].id;
    const src = (await getPool().query("INSERT INTO event_line_sources (event_line_id, source_type, warehouse_id, planned_qty) VALUES ($1, 'warehouse', $2, 1) RETURNING id", [line, wh])).rows[0].id;
    const round = (await getPool().query('INSERT INTO dispatch_rounds (event_id, round) VALUES ($1, 1) RETURNING id', [ev])).rows[0].id;
    const step = (await getPool().query("INSERT INTO checklist_steps (round_id, step) VALUES ($1, 'site_receipt') RETURNING id", [round])).rows[0].id;
    const entry = (await getPool().query('INSERT INTO checklist_entries (step_id, event_line_source_id) VALUES ($1, $2) RETURNING id', [step, src])).rows[0].id;
    const rep = (await getPool().query(
      `INSERT INTO damage_reports (number, event_id, event_line_source_id, step_id, entry_id, kind, quantity, reported_by, status, decided_at)
       VALUES ('DMG-T-' || gen_random_uuid(), $1, $2, $3, $4, 'damaged', 1, $5, 'approved', now()) RETURNING id`, [ev, src, step, entry, by])).rows[0].id;
    const key = `damage/test/${rep}.jpg`;
    memoryStorage.put(key, 100, 'image/jpeg');
    await getPool().query('INSERT INTO damage_photos (damage_report_id, storage_key, delete_after) VALUES ($1, $2, $3)', [rep, key, deleteAfter]);
    return { rep, key };
  }

  it('removes damage photos 6 months after the decision only on Closed events; the report stays', async () => {
    const admin = await webSessionFor(['super_admin']);
    await basicStock(admin.as);
    const old = await damagePhoto('closed', new Date(Date.now() - 86_400_000));
    const open = await damagePhoto('at_site', new Date(Date.now() - 86_400_000));
    const recent = await damagePhoto('closed', new Date(Date.now() + 86_400_000));
    expect(await purgeDamagePhotos()).toBe(1);
    expect(await memoryStorage.head(old.key)).toBeNull();
    expect(await memoryStorage.head(open.key)).not.toBeNull();
    expect(await memoryStorage.head(recent.key)).not.toBeNull();
    expect((await getPool().query('SELECT photos_deleted_at FROM damage_reports WHERE id = $1', [old.rep])).rows[0].photos_deleted_at).not.toBeNull();
    const view = (await (await retention(makeReq('GET', '/x', admin.as))).json()).items;
    expect(view.find((r: { rule: string }) => r.rule === 'damage_photos').lastRun.removed).toBe(1);
  });

  it('rolls old ledger entries into opening entries with balances unchanged; waits for open events', async () => {
    const admin = await webSessionFor(['admin']);
    const em = await webSessionFor(['event_manager']);
    const { chair, wh } = await basicStock(admin.as, '40');
    const before = await balanceOf(chair.id, wh.defaultLocationId, 'available');
    const ev = await (await createEvent(makeReq('POST', '/x', { ...admin.as, body: {
      name: 'Hold', venueName: 'V', startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), endsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      leaveWarehouseAt: new Date(Date.now() + 86_400_000).toISOString(), expectedReturnDate: new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10),
      eventManagerIds: [em.user.id], schedule: true, lines: [{ itemId: chair.id, plannedQty: '5', sources: [{ type: 'warehouse', warehouseId: wh.id, qty: '5' }] }] } }))).json();
    const future = new Date(Date.now() + 60_000);
    expect((await rollUpLedger(future)).status).toBe('blocked');
    await getPool().query("UPDATE events SET status = 'closed' WHERE id = $1", [ev.id]);
    const r = await rollUpLedger(future);
    expect(r.status).toBe('succeeded');
    expect(r.archived).toBeGreaterThan(0);
    expect(await rebuildMismatches(getPool())).toEqual([]);
    expect(await balanceOf(chair.id, wh.defaultLocationId, 'available')).toBe((Number(before) - 5).toFixed(3));
    expect((await getPool().query("SELECT count(*)::int AS n FROM stock_movements WHERE type = 'opening' AND reference_type = 'retention'")).rows[0].n).toBeGreaterThan(0);
    expect(await archiveAudit(future)).toBeGreaterThan(0);
  });
});

describe('system health (010 US7)', () => {
  it('shows failed messages, last backup and app versions', async () => {
    const sa = await webSessionFor(['super_admin']);
    await mobileTokenFor(sa.user.username, sa.user.password);
    for (let i = 0; i < 5; i++) await getPool().query("INSERT INTO messages (channel, to_address, trigger, rendered_text, status) VALUES ('whatsapp', '+91980000000' || $1, 'x', 'y', 'failed')", [i]);
    await runBackup('echo \'{"databaseBytes": 10}\'');
    const s = await (await status(makeReq('GET', '/x', sa.as))).json();
    expect(s.extended).toMatchObject({ failedMessages24h: 5, lastBackup: { status: 'succeeded', bytes: 10 } });
    expect(s.extended.appVersions.some((v: { platform: string }) => v.platform === 'android')).toBe(true);
  });
});
