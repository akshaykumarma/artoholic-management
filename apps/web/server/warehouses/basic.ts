import type { Warehouse } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';

const SELECT = `SELECT w.id, w.code, w.name, w.status, (SELECT l.id FROM locations l WHERE l.warehouse_id = w.id AND l.is_default) AS default_location_id FROM warehouses w`;
type Row = { id: string; code: string; name: string; status: 'active' | 'archived'; default_location_id: string | null };
const map = (r: Row): Warehouse => ({ id: r.id, code: r.code, name: r.name, status: r.status, defaultLocationId: r.default_location_id });

/** Minimal warehouse with one default location (003). Feature 004 adds layouts and bins. */
export async function createWarehouse(auth: Authenticated, input: { code: string; name: string }, ctx: RequestContext): Promise<Warehouse> {
  return withTransaction(async (tx) => {
    const exists = await tx.query('SELECT 1 FROM warehouses WHERE code = $1', [input.code]);
    if (exists.rowCount) throw new ApiError('CODE_TAKEN', { field: 'code' }, 'That warehouse code is already used.');
    const { rows } = await tx.query<{ id: string }>('INSERT INTO warehouses (code, name) VALUES ($1, $2) RETURNING id', [input.code, input.name]);
    const id = rows[0]!.id;
    await tx.query('INSERT INTO locations (warehouse_id, code, is_default) VALUES ($1, $2, true)', [id, `${input.code}-DEFAULT`]);
    await writeAudit(tx, { action: 'warehouse.created', actorUserId: auth.user.id, entityType: 'warehouse', entityId: id, after: input, ctx });
    const w = await tx.query<Row>(`${SELECT} WHERE w.id = $1`, [id]);
    return map(w.rows[0]!);
  });
}

/** Store Managers see only their assigned warehouses. */
export async function listWarehouses(auth: Authenticated): Promise<Warehouse[]> {
  const scoped = !auth.user.roles.includes('admin') && !auth.user.roles.includes('super_admin');
  const { rows } = await getPool().query<Row>(
    `${SELECT} WHERE ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM warehouse_assignments a WHERE a.warehouse_id = w.id AND a.user_id = $1 AND a.unassigned_at IS NULL)) ORDER BY w.code`,
    [scoped ? auth.user.id : null]
  );
  return rows.map(map);
}

/** Warehouse of a location, for scope checks. */
export async function warehouseOfLocation(locationId: string): Promise<string> {
  const { rows } = await getPool().query<{ warehouse_id: string }>('SELECT warehouse_id FROM locations WHERE id = $1', [locationId]);
  if (!rows[0]) throw new ApiError('NOT_FOUND', { locationId });
  return rows[0].warehouse_id;
}

/** Any active warehouse, for choosing a transfer destination (Store Managers may send anywhere). */
export async function listActiveWarehouses(): Promise<Warehouse[]> {
  const { rows } = await getPool().query<Row>(`${SELECT} WHERE w.status = 'active' ORDER BY w.code`);
  return rows.map(map);
}
