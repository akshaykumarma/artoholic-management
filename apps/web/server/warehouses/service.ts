import type { PoolClient } from 'pg';
import { expandBins, locationCode, normalisePhone, type Location, type Range, type WarehouseDetail } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import { requireWarehouseScope } from '../auth/guards';
import { now } from '../auth/clock';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';

type Tx = Pick<PoolClient, 'query'>;
const MAX_BULK = 2000;

export async function warehouseDetail(db: Tx, id: string): Promise<WarehouseDetail> {
  const { rows } = await db.query(
    `SELECT w.id, w.code, w.name, w.status, w.address, w.latitude::float8 AS latitude, w.longitude::float8 AS longitude, w.contact_phone_e164,
            (SELECT l.id FROM locations l WHERE l.warehouse_id = w.id AND l.is_default) AS default_location_id,
            COALESCE((SELECT array_agg(name ORDER BY position) FROM warehouse_levels WHERE warehouse_id = w.id), '{}') AS levels,
            (SELECT count(*)::int FROM locations l WHERE l.warehouse_id = w.id AND l.level > 0 AND l.level = (SELECT count(*) FROM warehouse_levels wl WHERE wl.warehouse_id = w.id)) AS bin_count,
            EXISTS (SELECT 1 FROM stock_balances b JOIN locations l ON l.id = b.location_id WHERE l.warehouse_id = w.id AND b.quantity > 0) AS has_stock
       FROM warehouses w WHERE w.id = $1`,
    [id]
  );
  const w = rows[0];
  if (!w) throw new ApiError('NOT_FOUND');
  const sms = await db.query<{ id: string; full_name: string }>(
    'SELECT u.id, u.full_name FROM warehouse_assignments a JOIN users u ON u.id = a.user_id WHERE a.warehouse_id = $1 AND a.unassigned_at IS NULL ORDER BY u.full_name',
    [id]
  );
  return {
    id: w.id, code: w.code, name: w.name, status: w.status, defaultLocationId: w.default_location_id, address: w.address,
    latitude: w.latitude, longitude: w.longitude, contactPhone: w.contact_phone_e164, levels: w.levels, binCount: w.bin_count, hasStock: w.has_stock,
    storeManagers: sms.rows.map((s) => ({ id: s.id, fullName: s.full_name }))
  };
}

export async function getWarehouse(auth: Authenticated, id: string): Promise<WarehouseDetail> {
  await requireWarehouseScope(auth, id);
  return warehouseDetail(getPool(), id);
}

export interface WarehouseUpdate {
  name?: string; address?: string; latitude?: number | null; longitude?: number | null; placeId?: string | null; contactPhone?: string | null;
  levels?: string[]; storeManagerIds?: string[]; status?: 'active' | 'archived';
}

/** Details, level names (count locked once locations exist), Store Managers, deactivation (004 FR-001/002). */
export async function updateWarehouse(auth: Authenticated, id: string, input: WarehouseUpdate, ctx: RequestContext): Promise<WarehouseDetail> {
  return withTransaction(async (tx) => {
    await tx.query('SELECT 1 FROM warehouses WHERE id = $1 FOR UPDATE', [id]);
    const before = await warehouseDetail(tx, id);
    if (input.levels) {
      const hasLocations = (await tx.query('SELECT 1 FROM locations WHERE warehouse_id = $1 AND level > 0 LIMIT 1', [id])).rowCount;
      if (hasLocations && input.levels.length !== before.levels.length) throw new ApiError('LEVELS_LOCKED');
      await tx.query('DELETE FROM warehouse_levels WHERE warehouse_id = $1', [id]);
      for (const [i, name] of input.levels.entries()) await tx.query('INSERT INTO warehouse_levels (warehouse_id, position, name) VALUES ($1, $2, $3)', [id, i + 1, name]);
    }
    if (input.storeManagerIds) {
      const { rows } = await tx.query<{ id: string }>(
        "SELECT u.id FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'store_manager' WHERE u.id = ANY($1::uuid[]) AND u.status = 'active'",
        [input.storeManagerIds]
      );
      if (rows.length !== new Set(input.storeManagerIds).size) throw new ApiError('VALIDATION_FAILED', { fields: { storeManagerIds: 'Choose active users with the Store Manager role' } });
      await tx.query('UPDATE warehouse_assignments SET unassigned_at = $3, unassigned_by = $4 WHERE warehouse_id = $1 AND unassigned_at IS NULL AND NOT (user_id = ANY($2::uuid[]))', [id, input.storeManagerIds, now(), auth.user.id]);
      for (const uid of input.storeManagerIds) {
        await tx.query(
          `INSERT INTO warehouse_assignments (user_id, warehouse_id, assigned_by) SELECT $1, $2, $3
           WHERE NOT EXISTS (SELECT 1 FROM warehouse_assignments WHERE user_id = $1 AND warehouse_id = $2 AND unassigned_at IS NULL)`,
          [uid, id, auth.user.id]
        );
      }
    }
    if (input.status === 'archived' && before.status === 'active') {
      if (before.hasStock) throw new ApiError('LOCATION_NOT_EMPTY', { warehouseId: id }, 'This warehouse still holds stock.');
      const open = await tx.query("SELECT 1 FROM transfers WHERE (from_warehouse_id = $1 OR to_warehouse_id = $1) AND status IN ('requested', 'dispatched') LIMIT 1", [id]);
      if (open.rowCount) throw new ApiError('TRANSFER_STATE', { warehouseId: id }, 'This warehouse has open transfers.');
    }
    const phone = input.contactPhone === undefined ? undefined : input.contactPhone ? normalisePhone(input.contactPhone) : null;
    if (input.contactPhone && !phone) throw new ApiError('VALIDATION_FAILED', { fields: { contactPhone: 'Enter a valid phone number' } });
    await tx.query(
      `UPDATE warehouses SET name = COALESCE($2, name), address = COALESCE($3, address),
         latitude = CASE WHEN $4::boolean THEN $5 ELSE latitude END, longitude = CASE WHEN $4::boolean THEN $6 ELSE longitude END,
         place_id = CASE WHEN $7::boolean THEN $8 ELSE place_id END, contact_phone_e164 = CASE WHEN $9::boolean THEN $10 ELSE contact_phone_e164 END,
         status = COALESCE($11::item_status, status), updated_at = $12 WHERE id = $1`,
      [id, input.name ?? null, input.address ?? null, input.latitude !== undefined, input.latitude ?? null, input.longitude ?? null,
        input.placeId !== undefined, input.placeId ?? null, phone !== undefined, phone ?? null, input.status ?? null, now()]
    );
    const after = await warehouseDetail(tx, id);
    await writeAudit(tx, { action: 'warehouse.updated', actorUserId: auth.user.id, entityType: 'warehouse', entityId: id, before, after, ctx });
    return after;
  });
}

const LOC_SELECT = `SELECT l.id, l.code, l.level, l.parent_id, l.segment, l.status, l.is_default,
  (NOT l.is_default AND l.level = (SELECT count(*) FROM warehouse_levels wl WHERE wl.warehouse_id = l.warehouse_id)) AS is_bin FROM locations l`;
type LocRow = { id: string; code: string; level: number; parent_id: string | null; segment: string | null; status: 'active' | 'archived'; is_default: boolean; is_bin: boolean };
const mapLoc = (r: LocRow): Location => ({ id: r.id, code: r.code, level: r.level, parentId: r.parent_id, segment: r.segment, status: r.status, isDefault: r.is_default, isBin: r.is_bin });

export async function listLocations(auth: Authenticated, warehouseId: string, q: { parentId?: string; q?: string }): Promise<Location[]> {
  await requireWarehouseScope(auth, warehouseId);
  const { rows } = await getPool().query<LocRow>(
    `${LOC_SELECT} WHERE l.warehouse_id = $1 AND ($2::uuid IS NULL OR l.parent_id = $2) AND ($3::text IS NULL OR l.code ILIKE '%' || $3 || '%')
       AND ($2::uuid IS NOT NULL OR $3::text IS NOT NULL OR l.level <= 1) ORDER BY l.code LIMIT 500`,
    [warehouseId, q.parentId ?? null, q.q?.trim() || null]
  );
  return rows.map(mapLoc);
}

async function levelsOf(tx: Tx, warehouseId: string): Promise<{ code: string; count: number }> {
  const { rows } = await tx.query<{ code: string; n: number }>('SELECT w.code, (SELECT count(*)::int FROM warehouse_levels WHERE warehouse_id = w.id) AS n FROM warehouses w WHERE w.id = $1', [warehouseId]);
  if (!rows[0]) throw new ApiError('NOT_FOUND');
  if (rows[0].n === 0) throw new ApiError('VALIDATION_FAILED', { fields: { levels: 'Name the location levels first' } });
  return { code: rows[0].code, count: rows[0].n };
}

async function parentInfo(tx: Tx, warehouseId: string, parentId: string | null | undefined) {
  if (!parentId) return { level: 0, segments: [] as string[], id: null as string | null };
  const { rows } = await tx.query<{ level: number; code: string; warehouse_id: string }>('SELECT level, code, warehouse_id FROM locations WHERE id = $1', [parentId]);
  const p = rows[0];
  if (!p || p.warehouse_id !== warehouseId || p.level === 0) throw new ApiError('VALIDATION_FAILED', { fields: { parentId: 'Unknown parent location' } });
  return { level: p.level, segments: p.code.split('-').slice(1), id: parentId };
}

/** Plans bulk creation: bins for the given ranges below the parent, with any missing intermediate levels (004 R2). */
async function planBulk(tx: Tx, warehouseId: string, parentId: string | null | undefined, ranges: Range[]) {
  const { code, count } = await levelsOf(tx, warehouseId);
  const parent = await parentInfo(tx, warehouseId, parentId);
  if (parent.level + ranges.length !== count) throw new ApiError('VALIDATION_FAILED', { fields: { ranges: `Give one range per level down to the bins (${count - parent.level} needed)` } });
  let paths: string[][];
  try {
    paths = expandBins(ranges).map((p) => [...parent.segments, ...p]);
  } catch (e) {
    throw new ApiError('VALIDATION_FAILED', { fields: { ranges: (e as Error).message } });
  }
  if (paths.length > MAX_BULK) throw new ApiError('VALIDATION_FAILED', { fields: { ranges: `At most ${MAX_BULK} bins per request (this would make ${paths.length})` } });
  const codes = paths.map((p) => locationCode(code, p));
  const { rows } = await tx.query<{ code: string }>('SELECT code FROM locations WHERE code = ANY($1)', [codes]);
  const existing = new Set(rows.map((r) => r.code));
  return { code, parent, paths: paths.filter((_, i) => !existing.has(codes[i]!)), skip: codes.filter((c) => existing.has(c)) };
}

export async function previewBulk(auth: Authenticated, warehouseId: string, parentId: string | null | undefined, ranges: Range[]) {
  await requireWarehouseScope(auth, warehouseId);
  const plan = await planBulk(getPool(), warehouseId, parentId, ranges);
  return { create: plan.paths.length, skip: plan.skip };
}

export async function createBulk(auth: Authenticated, warehouseId: string, parentId: string | null | undefined, ranges: Range[], ctx: RequestContext) {
  await requireWarehouseScope(auth, warehouseId);
  return withTransaction(async (tx) => {
    const plan = await planBulk(tx, warehouseId, parentId, ranges);
    const ids = new Map<string, string>();
    const { rows: existing } = await tx.query<{ id: string; code: string }>('SELECT id, code FROM locations WHERE warehouse_id = $1', [warehouseId]);
    for (const r of existing) ids.set(r.code, r.id);
    const created: string[] = [];
    for (const path of plan.paths) {
      let parent: string | null = null;
      for (let lvl = 1; lvl <= path.length; lvl++) {
        const c = locationCode(plan.code, path.slice(0, lvl));
        let id: string | undefined = ids.get(c);
        if (!id) {
          const ins: { rows: Array<{ id: string }> } = await tx.query<{ id: string }>(
            'INSERT INTO locations (warehouse_id, code, parent_id, level, segment) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [warehouseId, c, parent, lvl, path[lvl - 1]]
          );
          const newId: string = ins.rows[0]!.id;
          id = newId;
          ids.set(c, newId);
          if (lvl === path.length) created.push(c);
        }
        parent = id ?? null;
      }
    }
    await writeAudit(tx, { action: 'locations.bulk_created', actorUserId: auth.user.id, entityType: 'warehouse', entityId: warehouseId, after: { created: created.length, ranges }, ctx });
    return { created, skipped: plan.skip };
  });
}

export async function createLocation(auth: Authenticated, warehouseId: string, parentId: string | null | undefined, segment: string, ctx: RequestContext) {
  await requireWarehouseScope(auth, warehouseId);
  return withTransaction(async (tx) => {
    const { code, count } = await levelsOf(tx, warehouseId);
    const parent = await parentInfo(tx, warehouseId, parentId);
    if (parent.level >= count) throw new ApiError('VALIDATION_FAILED', { fields: { parentId: 'Bins cannot have children' } });
    const c = locationCode(code, [...parent.segments, segment.toUpperCase()]);
    if ((await tx.query('SELECT 1 FROM locations WHERE code = $1', [c])).rowCount) throw new ApiError('CODE_TAKEN', { code: c }, `${c} already exists.`);
    const { rows } = await tx.query<LocRow>(
      `INSERT INTO locations (warehouse_id, code, parent_id, level, segment) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, code, level, parent_id, segment, status, is_default, (level = $6) AS is_bin`,
      [warehouseId, c, parent.id, parent.level + 1, segment.toUpperCase(), count]
    );
    await writeAudit(tx, { action: 'location.created', actorUserId: auth.user.id, entityType: 'location', entityId: rows[0]!.id, after: { code: c }, ctx });
    return mapLoc(rows[0]!);
  });
}

/** Deactivate only when empty (FR-007); rename only if the location never held stock. */
export async function updateLocation(auth: Authenticated, id: string, input: { segment?: string; status?: 'active' | 'archived' }, ctx: RequestContext) {
  const { rows: w } = await getPool().query<{ warehouse_id: string }>('SELECT warehouse_id FROM locations WHERE id = $1', [id]);
  if (!w[0]) throw new ApiError('NOT_FOUND');
  await requireWarehouseScope(auth, w[0].warehouse_id);
  return withTransaction(async (tx) => {
    const sub = `WITH RECURSIVE t AS (SELECT id FROM locations WHERE id = $1 UNION ALL SELECT l.id FROM locations l JOIN t ON l.parent_id = t.id) SELECT id FROM t`;
    if (input.status === 'archived') {
      const { rows } = await tx.query<{ condition: string; q: string }>(
        `SELECT b.condition, sum(b.quantity)::text AS q FROM stock_balances b WHERE b.location_id IN (${sub}) AND b.quantity > 0 GROUP BY b.condition`,
        [id]
      );
      if (rows.length) throw new ApiError('LOCATION_NOT_EMPTY', { holdings: rows });
    }
    if (input.segment) {
      const used = await tx.query(`SELECT 1 FROM stock_movements WHERE from_location_id IN (${sub}) OR to_location_id IN (${sub}) LIMIT 1`, [id]);
      if (used.rowCount) throw new ApiError('CODE_LOCKED', { locationId: id }, "This location's code is in use and can't be renamed.");
      const { rows } = await tx.query<{ code: string }>('SELECT code FROM locations WHERE id = $1', [id]);
      const parts = rows[0]!.code.split('-');
      parts[parts.length - 1] = input.segment.toUpperCase();
      await tx.query('UPDATE locations SET segment = $2, code = $3 WHERE id = $1', [id, input.segment.toUpperCase(), parts.join('-')]);
    }
    if (input.status) await tx.query('UPDATE locations SET status = $2 WHERE id = $1', [id, input.status]);
    const { rows } = await tx.query<LocRow>(`${LOC_SELECT} WHERE l.id = $1`, [id]);
    await writeAudit(tx, { action: 'location.updated', actorUserId: auth.user.id, entityType: 'location', entityId: id, after: input, ctx });
    return mapLoc(rows[0]!);
  });
}

/** Bins that already hold the item first, then other bins by code (004 FR-009). */
export async function binSuggestions(auth: Authenticated, warehouseId: string, itemId: string | undefined, q: string | undefined) {
  await requireWarehouseScope(auth, warehouseId);
  const { rows } = await getPool().query<{ id: string; code: string; quantity: string | null }>(
    `SELECT l.id, l.code, (SELECT sum(quantity)::numeric(14,3)::text FROM stock_balances b WHERE b.location_id = l.id AND b.item_id = $2 AND b.quantity > 0) AS quantity
       FROM locations l
      WHERE l.warehouse_id = $1 AND l.status = 'active' AND NOT l.is_default AND l.level = (SELECT count(*) FROM warehouse_levels WHERE warehouse_id = $1)
        AND ($3::text IS NULL OR l.code ILIKE '%' || $3 || '%')
      ORDER BY (SELECT sum(quantity) FROM stock_balances b WHERE b.location_id = l.id AND b.item_id = $2) DESC NULLS LAST, l.code
      LIMIT 20`,
    [warehouseId, itemId ?? null, q?.trim() || null]
  );
  return rows;
}
