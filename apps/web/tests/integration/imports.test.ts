import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { POST as upload } from '../../app/api/v1/imports/route';
import { POST as commit } from '../../app/api/v1/imports/[id]/commit/route';
import { GET as template } from '../../app/api/v1/imports/templates/[kind]/route';
import { webSessionFor } from '../session-helpers';
import { category, warehouse, item } from '../inventory-helpers';
import { getPool } from '../../db/client';

function multipart(as: { cookies: Record<string, string>; csrf: string }, kind: string, name: string, data: Buffer | string, type: string) {
  const form = new FormData();
  form.set('kind', kind);
  form.set('file', new Blob([typeof data === 'string' ? data : new Uint8Array(data)], { type }), name);
  return new Request('http://localhost/api/v1/imports', {
    method: 'POST',
    body: form,
    headers: {
      'x-client-platform': 'web', 'x-client-version': '1.0.0', 'x-forwarded-for': '203.0.113.10',
      cookie: Object.entries(as.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; '),
      'x-csrf-token': as.csrf
    }
  });
}

describe('import with dry run (003 US2)', () => {
  it('previews row errors and refuses to commit until fixed', async () => {
    const admin = await webSessionFor(['admin']);
    await category(admin.as, 'Furniture');
    const csv = 'name,code,category,subcategory,tracking_type,unit,replacement_value_rupees,minimum_stock,minimum_usable_length,description\n' +
      'Chair,,Furniture,,counted,,500,20,,White chair\n' +
      'Rope,,Furniture,,measured,,80,,,missing unit\n';
    const res = await upload(multipart(admin.as, 'items', 'items.csv', csv, 'text/csv'));
    expect(res.status).toBe(201);
    const batch = await res.json();
    expect(batch.validRows).toBe(1);
    expect(batch.errors).toEqual([expect.objectContaining({ row: 3, message: expect.stringMatching(/unit/i) })]);
    const blocked = await commit(new Request(`http://localhost/api/v1/imports/${batch.id}/commit`, { method: 'POST', headers: { 'x-client-platform': 'web', cookie: `session=${admin.cookies.session}; csrf=${admin.cookies.csrf}`, 'x-csrf-token': admin.as.csrf } }), { params: { id: batch.id } });
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).error.code).toBe('IMPORT_HAS_ERRORS');
  });

  it('commits an xlsx opening-stock import as opening movements referencing the batch', async () => {
    const admin = await webSessionFor(['admin']);
    const cat = await category(admin.as);
    const chair = await item(admin.as, { name: 'Chair', categoryId: cat, trackingType: 'counted' });
    await warehouse(admin.as, 'MAIN');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('opening_stock');
    ws.addRow(['item_code', 'warehouse_code', 'location_code', 'condition', 'quantity']);
    ws.addRow([chair.code, 'MAIN', '', 'available', 40]);
    ws.addRow([chair.code, 'MAIN', '', 'damaged', 2]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const batch = await (await upload(multipart(admin.as, 'opening_stock', 'stock.xlsx', buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))).json();
    expect(batch.errors).toEqual([]);
    const res = await commit(new Request(`http://localhost/api/v1/imports/${batch.id}/commit`, { method: 'POST', headers: { 'x-client-platform': 'web', cookie: `session=${admin.cookies.session}; csrf=${admin.cookies.csrf}`, 'x-csrf-token': admin.as.csrf } }), { params: { id: batch.id } });
    expect(res.status).toBe(200);
    const { rows } = await getPool().query("SELECT count(*)::int AS n, sum(quantity)::text AS q FROM stock_movements WHERE type = 'opening' AND reference_type = 'import_batch' AND reference_id = $1", [batch.id]);
    expect(rows[0]).toEqual({ n: 2, q: '42.000' });
  });

  it('serves a downloadable template per kind', async () => {
    const admin = await webSessionFor(['admin']);
    const res = await template(new Request('http://localhost/api/v1/imports/templates/items', { headers: { 'x-client-platform': 'web', cookie: `session=${admin.cookies.session}` } }), { params: { kind: 'items' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
  });
});
