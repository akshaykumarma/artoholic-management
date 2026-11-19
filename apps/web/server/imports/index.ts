import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import Decimal from 'decimal.js';
import { isQuantity, TRACKING_TYPES } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';
import { createItem } from '../catalogue/items';
import { postOpening } from '../stock/operations';

export type ImportKind = 'items' | 'opening_stock';
const MAX_ROWS = 5000;

export const TEMPLATES: Record<ImportKind, string[]> = {
  items: ['name', 'code', 'category', 'subcategory', 'tracking_type', 'unit', 'replacement_value_rupees', 'minimum_stock', 'minimum_usable_length', 'description'],
  opening_stock: ['item_code', 'warehouse_code', 'location_code', 'condition', 'quantity']
};

type Raw = Record<string, string>;
interface RowError { row: number; message: string }

async function readRows(fileName: string, data: Buffer): Promise<Raw[]> {
  if (/\.csv$/i.test(fileName)) {
    return parseCsv(data, { columns: (h: string[]) => h.map((x) => x.trim().toLowerCase()), skip_empty_lines: true, trim: true }) as Raw[];
  }
  if (!/\.xlsx$/i.test(fileName)) throw new ApiError('VALIDATION_FAILED', { fields: { file: 'Use .xlsx or .csv' } });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (headers[i - 1] = String(c.value ?? '').trim().toLowerCase()));
  const out: Raw[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const r: Raw = {};
    headers.forEach((h, i) => {
      const v = row.getCell(i + 1).value;
      r[h] = v === null || v === undefined ? '' : String(typeof v === 'object' && 'result' in v ? v.result : v).trim();
    });
    if (Object.values(r).some((v) => v !== '')) out.push(r);
  });
  return out;
}

async function validateItems(rows: Raw[]): Promise<{ valid: unknown[]; errors: RowError[] }> {
  const db = getPool();
  const cats = (await db.query<{ id: string; name: string; parent_name: string | null; status: string }>(
    'SELECT c.id, c.name, p.name AS parent_name, c.status FROM categories c LEFT JOIN categories p ON p.id = c.parent_id'
  )).rows;
  const units = new Set((await db.query<{ code: string }>("SELECT code FROM units WHERE status = 'active'")).rows.map((u) => u.code));
  const seen = new Set<string>();
  const valid: unknown[] = [];
  const errors: RowError[] = [];
  for (const [i, r] of rows.entries()) {
    const row = i + 2;
    const fail = (message: string) => errors.push({ row, message });
    if (!r.name) { fail('Name is required'); continue; }
    const cat = r.subcategory
      ? cats.find((c) => c.name.toLowerCase() === r.subcategory!.toLowerCase() && c.parent_name?.toLowerCase() === (r.category ?? '').toLowerCase())
      : cats.find((c) => c.name.toLowerCase() === (r.category ?? '').toLowerCase() && c.parent_name === null);
    if (!cat || cat.status !== 'active') { fail(`Unknown or archived category "${r.subcategory || r.category}"`); continue; }
    const tracking = (r.tracking_type ?? '').toLowerCase();
    if (!(TRACKING_TYPES as readonly string[]).includes(tracking)) { fail('tracking_type must be counted, measured or cut'); continue; }
    const unit = r.unit?.toLowerCase() || null;
    if (tracking === 'counted' && unit) { fail('Counted items have no unit'); continue; }
    if (tracking !== 'counted' && (!unit || !units.has(unit))) { fail('A known unit is required for measured and cut items'); continue; }
    if (!/^\d+(\.\d{1,2})?$/.test(r.replacement_value_rupees || '0')) { fail('replacement_value_rupees must be a number'); continue; }
    if (r.minimum_stock && !isQuantity(r.minimum_stock)) { fail('minimum_stock must be a number'); continue; }
    if (r.minimum_usable_length && (tracking !== 'cut' || !isQuantity(r.minimum_usable_length))) { fail('minimum_usable_length only for cut items'); continue; }
    if (r.code) {
      const code = r.code.toUpperCase();
      if (seen.has(code) || (await db.query('SELECT 1 FROM item_codes WHERE code = $1', [code])).rowCount) { fail(`Code ${code} is already used`); continue; }
      seen.add(code);
    }
    valid.push({
      name: r.name, code: r.code ? r.code.toUpperCase() : undefined, categoryId: cat.id, description: r.description ?? '', trackingType: tracking,
      unitCode: unit, replacementValuePaise: new Decimal(r.replacement_value_rupees || '0').mul(100).toNumber(),
      minimumStock: r.minimum_stock || null, minimumUsableLength: r.minimum_usable_length || null
    });
  }
  return { valid, errors };
}

async function validateOpening(rows: Raw[]): Promise<{ valid: unknown[]; errors: RowError[] }> {
  const db = getPool();
  const valid: unknown[] = [];
  const errors: RowError[] = [];
  for (const [i, r] of rows.entries()) {
    const row = i + 2;
    const fail = (message: string) => errors.push({ row, message });
    const item = (await db.query<{ item_id: string; tracking_type: string }>('SELECT c.item_id, i.tracking_type FROM item_codes c JOIN items i ON i.id = c.item_id WHERE c.code = $1', [r.item_code ?? ''])).rows[0];
    if (!item) { fail(`Unknown item code "${r.item_code}"`); continue; }
    const wh = (await db.query<{ id: string }>('SELECT id FROM warehouses WHERE code = $1', [(r.warehouse_code ?? '').toUpperCase()])).rows[0];
    if (!wh) { fail(`Unknown warehouse "${r.warehouse_code}"`); continue; }
    const loc = r.location_code
      ? (await db.query<{ id: string }>("SELECT id FROM locations WHERE warehouse_id = $1 AND code = $2 AND status = 'active'", [wh.id, r.location_code.toUpperCase()])).rows[0]
      : (await db.query<{ id: string }>('SELECT id FROM locations WHERE warehouse_id = $1 AND is_default', [wh.id])).rows[0];
    if (!loc) { fail(`Unknown location "${r.location_code}"`); continue; }
    const condition = (r.condition || 'available').toLowerCase();
    if (condition !== 'available' && condition !== 'damaged') { fail('condition must be available or damaged'); continue; }
    const quantity = r.quantity ?? '';
    if (!isQuantity(quantity, { counted: item.tracking_type === 'counted' }) || Number(quantity) <= 0) { fail('quantity must be a positive number (whole for counted items)'); continue; }
    valid.push({ itemId: item.item_id, locationId: loc.id, condition, quantity });
  }
  return { valid, errors };
}

/** Upload → parse → validate every row → store a preview; nothing is saved to the catalogue yet (FR-004). */
export async function previewImport(auth: Authenticated, kind: ImportKind, fileName: string, data: Buffer, ctx: RequestContext) {
  const rows = await readRows(fileName, data);
  if (rows.length > MAX_ROWS) throw new ApiError('VALIDATION_FAILED', { fields: { file: `At most ${MAX_ROWS} rows per file` } });
  const { valid, errors } = kind === 'items' ? await validateItems(rows) : await validateOpening(rows);
  const { rows: ins } = await getPool().query<{ id: string }>(
    'INSERT INTO import_batches (kind, file_name, uploaded_by, rows, errors) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [kind, fileName, auth.user.id, JSON.stringify(valid), JSON.stringify(errors)]
  );
  await writeAudit(getPool(), { action: 'import.previewed', actorUserId: auth.user.id, entityType: 'import_batch', entityId: ins[0]!.id, after: { kind, fileName, rows: rows.length, errors: errors.length }, ctx });
  return { id: ins[0]!.id, kind, totalRows: rows.length, validRows: valid.length, errors };
}

/** Commits a clean preview in one transaction, referencing the batch (FR-004). */
export async function commitImport(auth: Authenticated, id: string, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ kind: ImportKind; rows: unknown[]; errors: RowError[]; status: string }>('SELECT kind, rows, errors, status FROM import_batches WHERE id = $1 FOR UPDATE', [id]);
    const b = rows[0];
    if (!b) throw new ApiError('NOT_FOUND');
    if (b.status !== 'previewed') throw new ApiError('REQUEST_DECIDED', undefined, 'This import was already committed or discarded.');
    if (b.errors.length) throw new ApiError('IMPORT_HAS_ERRORS', { errors: b.errors.length });
    if (b.kind === 'items') {
      for (const r of b.rows) await createItem(auth, r as Parameters<typeof createItem>[1], ctx, tx);
    } else {
      await postOpening(tx, auth, b.rows as Parameters<typeof postOpening>[2], { type: 'import_batch', id }, ctx);
    }
    await tx.query("UPDATE import_batches SET status = 'committed', committed_at = now() WHERE id = $1", [id]);
    await writeAudit(tx, { action: 'import.committed', actorUserId: auth.user.id, entityType: 'import_batch', entityId: id, after: { kind: b.kind, rows: b.rows.length }, ctx });
    return { id, committed: b.rows.length };
  });
}

export async function templateXlsx(kind: ImportKind): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(kind);
  ws.addRow(TEMPLATES[kind]);
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => (c.width = 20));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
