import type { PoolClient } from 'pg';

type Tx = Pick<PoolClient, 'query'>;

export async function assigneeIds(tx: Tx, eventId: string, role?: 'event_manager' | 'store_manager'): Promise<string[]> {
  const { rows } = await tx.query<{ user_id: string }>(
    `SELECT DISTINCT a.user_id FROM event_assignments a JOIN users u ON u.id = a.user_id
      WHERE a.event_id = $1 AND a.removed_at IS NULL AND u.status = 'active' AND ($2::text IS NULL OR a.role_on_event = $2)`,
    [eventId, role ?? null]
  );
  return rows.map((r) => r.user_id);
}

/** Every event's Admins are all Admins (005 assumption) — plus the Super Admin. */
export async function adminIds(tx: Tx): Promise<string[]> {
  const { rows } = await tx.query<{ id: string }>(
    "SELECT DISTINCT u.id FROM users u JOIN user_roles r ON r.user_id = u.id WHERE r.role IN ('admin', 'super_admin') AND u.status = 'active'"
  );
  return rows.map((r) => r.id);
}

/** Over-booking audience (owner decision Q4): the event's Admins, Event Managers and Store Managers. */
export async function everyoneInvolved(tx: Tx, eventId: string): Promise<string[]> {
  return [...new Set([...(await adminIds(tx)), ...(await assigneeIds(tx, eventId))])];
}
