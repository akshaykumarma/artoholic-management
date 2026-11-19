import { getPool } from '../../db/client';
import type { Authenticated } from '../auth/sessions';

/** Who sees what (009 research R5): Admins everything; Store Managers their warehouses; Event Managers their events. */
export interface Scope { all: boolean; warehouseIds: string[]; eventIds: string[]; userId: string }

export async function scopeFor(auth: Authenticated | null): Promise<Scope> {
  if (!auth) return { all: true, warehouseIds: [], eventIds: [], userId: '' };
  const roles = auth.user.roles;
  if (roles.includes('admin') || roles.includes('super_admin')) return { all: true, warehouseIds: [], eventIds: [], userId: auth.user.id };
  const pool = getPool();
  const wh = roles.includes('store_manager')
    ? (await pool.query<{ warehouse_id: string }>('SELECT warehouse_id FROM warehouse_assignments WHERE user_id = $1 AND unassigned_at IS NULL', [auth.user.id])).rows.map((r) => r.warehouse_id)
    : [];
  const { rows } = await pool.query<{ id: string }>(
    `SELECT DISTINCT e.id FROM events e WHERE EXISTS (SELECT 1 FROM event_assignments a WHERE a.event_id = e.id AND a.user_id = $1 AND a.removed_at IS NULL)
        OR EXISTS (SELECT 1 FROM event_lines l JOIN event_line_sources s ON s.event_line_id = l.id WHERE l.event_id = e.id AND s.warehouse_id = ANY($2::uuid[]))`,
    [auth.user.id, wh]
  );
  return { all: false, warehouseIds: wh, eventIds: rows.map((r) => r.id), userId: auth.user.id };
}
