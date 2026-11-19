import type { PoolClient } from 'pg';
import { istDate, nextDueOnOrAfter, type CountSchedule, type Frequency } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';

type Tx = Pick<PoolClient, 'query'>;

export async function scheduleView(db: Tx, id: string): Promise<CountSchedule> {
  const { rows } = await db.query(
    'SELECT id, name, frequency, start_date::text AS start, next_due_date::text AS next, blind, status FROM count_schedules WHERE id = $1', [id]
  );
  const s = rows[0];
  if (!s) throw new ApiError('NOT_FOUND');
  const scope = await db.query<{ warehouse_id: string | null; category_id: string | null }>('SELECT warehouse_id, category_id FROM count_schedule_scope WHERE schedule_id = $1', [id]);
  const people = await db.query<{ id: string; full_name: string }>(
    'SELECT u.id, u.full_name FROM count_schedule_assignees a JOIN users u ON u.id = a.user_id WHERE a.schedule_id = $1 ORDER BY u.full_name', [id]
  );
  return {
    id: s.id, name: s.name, frequency: s.frequency, startDate: s.start, nextDueDate: s.next, blind: s.blind, status: s.status,
    scope: { warehouseIds: scope.rows.filter((r) => r.warehouse_id).map((r) => r.warehouse_id!), categoryIds: scope.rows.filter((r) => r.category_id).map((r) => r.category_id!) },
    assignees: people.rows.map((p) => ({ id: p.id, fullName: p.full_name }))
  };
}

export async function listSchedules(): Promise<CountSchedule[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM count_schedules ORDER BY status, next_due_date, name');
  return Promise.all(rows.map((r) => scheduleView(pool, r.id)));
}

/** Store Managers only (counts are done by the people who run the warehouse). */
export async function checkAssignees(tx: Tx, ids: string[]) {
  const { rows } = await tx.query<{ id: string }>(
    "SELECT u.id FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'store_manager' WHERE u.id = ANY($1::uuid[]) AND u.status = 'active'", [ids]
  );
  if (rows.length !== new Set(ids).size) throw new ApiError('VALIDATION_FAILED', { fields: { assigneeIds: 'Choose active Store Managers' } });
}

async function setScope(tx: Tx, id: string, scope: { warehouseIds: string[]; categoryIds: string[] }) {
  await tx.query('DELETE FROM count_schedule_scope WHERE schedule_id = $1', [id]);
  for (const w of new Set(scope.warehouseIds)) await tx.query('INSERT INTO count_schedule_scope (schedule_id, warehouse_id) VALUES ($1, $2)', [id, w]);
  for (const c of new Set(scope.categoryIds)) await tx.query('INSERT INTO count_schedule_scope (schedule_id, category_id) VALUES ($1, $2)', [id, c]);
}

async function setAssignees(tx: Tx, id: string, ids: string[]) {
  await checkAssignees(tx, ids);
  await tx.query('DELETE FROM count_schedule_assignees WHERE schedule_id = $1', [id]);
  for (const u of new Set(ids)) await tx.query('INSERT INTO count_schedule_assignees (schedule_id, user_id) VALUES ($1, $2)', [id, u]);
}

export async function createSchedule(auth: Authenticated, input: { name: string; frequency: Frequency; startDate: string; scope: { warehouseIds: string[]; categoryIds: string[] }; assigneeIds: string[]; blind: boolean }, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const next = nextDueOnOrAfter(input.startDate, input.frequency, istDate(now()));
    const { rows } = await tx.query<{ id: string }>(
      'INSERT INTO count_schedules (name, frequency, start_date, next_due_date, blind, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [input.name, input.frequency, input.startDate, next, input.blind, auth.user.id]
    );
    const id = rows[0]!.id;
    await setScope(tx, id, input.scope);
    await setAssignees(tx, id, input.assigneeIds);
    const after = await scheduleView(tx, id);
    await writeAudit(tx, { action: 'count_schedule.created', actorUserId: auth.user.id, entityType: 'count_schedule', entityId: id, after, ctx });
    return after;
  });
}

/** Edit, pause or resume; resuming skips the periods missed while paused (US1-2). */
export async function updateSchedule(auth: Authenticated, id: string, input: Partial<{ name: string; frequency: Frequency; startDate: string; scope: { warehouseIds: string[]; categoryIds: string[] }; assigneeIds: string[]; blind: boolean; status: 'active' | 'paused' }>, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    await tx.query('SELECT 1 FROM count_schedules WHERE id = $1 FOR UPDATE', [id]);
    const before = await scheduleView(tx, id);
    const frequency = input.frequency ?? before.frequency;
    const start = input.startDate ?? before.startDate;
    const recompute = input.frequency || input.startDate || (input.status === 'active' && before.status === 'paused');
    const next = recompute ? nextDueOnOrAfter(start, frequency, istDate(now())) : before.nextDueDate;
    await tx.query(
      `UPDATE count_schedules SET name = COALESCE($2, name), frequency = $3, start_date = $4, next_due_date = $5, blind = COALESCE($6, blind),
         status = COALESCE($7, status), updated_at = $8 WHERE id = $1`,
      [id, input.name ?? null, frequency, start, next, input.blind ?? null, input.status ?? null, now()]
    );
    if (input.scope) await setScope(tx, id, input.scope);
    if (input.assigneeIds) await setAssignees(tx, id, input.assigneeIds);
    const after = await scheduleView(tx, id);
    await writeAudit(tx, { action: 'count_schedule.updated', actorUserId: auth.user.id, entityType: 'count_schedule', entityId: id, before, after, ctx });
    return after;
  });
}
