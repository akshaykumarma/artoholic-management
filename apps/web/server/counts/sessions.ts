import type { PoolClient } from 'pg';
import { istDate, istInstant, nextDueAfter, type CountSessionRow, type Frequency } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { emit } from '../notifications/outbox';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import { issueRecordNumber } from '../sequences/issue';
import { adminIds } from '../events/recipients';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';
import { checkAssignees } from './schedules';

type Tx = Pick<PoolClient, 'query'>;
const isAdmin = (auth: Authenticated) => auth.user.roles.includes('admin') || auth.user.roles.includes('super_admin');

/**
 * Creates a session and snapshots recorded stock in scope (research R2): every item, piece, bin and
 * condition (available, reserved, damaged) held in a location, with the ledger position at that moment.
 * Out stock is at events and excluded. Deactivated warehouses are skipped and noted.
 */
export async function createSession(tx: Tx, o: {
  scheduleId: string | null; dueDate: string; blind: boolean; warehouseIds: string[]; categoryIds: string[]; assigneeIds: string[]; createdBy: string | null;
}): Promise<string | null> {
  const { rows: inactive } = await tx.query<{ code: string }>("SELECT code FROM warehouses WHERE id = ANY($1::uuid[]) AND status <> 'active'", [o.warehouseIds]);
  if (o.scheduleId && (await tx.query('SELECT 1 FROM count_sessions WHERE schedule_id = $1 AND due_date = $2', [o.scheduleId, o.dueDate])).rowCount) return null;
  const notes = inactive.length ? `Skipped deactivated warehouse(s): ${inactive.map((w) => w.code).join(', ')}` : '';
  const number = await issueRecordNumber(tx, 'count_session');
  const { rows: mv } = await tx.query<{ m: string }>('SELECT COALESCE(max(id), 0)::text AS m FROM stock_movements');
  const ins = await tx.query<{ id: string }>(
    `INSERT INTO count_sessions (number, schedule_id, due_date, blind, scope, notes, snapshot_at, snapshot_movement_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (schedule_id, due_date) WHERE schedule_id IS NOT NULL DO NOTHING RETURNING id`,
    [number, o.scheduleId, o.dueDate, o.blind, JSON.stringify({ warehouseIds: o.warehouseIds, categoryIds: o.categoryIds }), notes, now(), mv[0]!.m, o.createdBy]
  );
  if (!ins.rows[0]) return null;
  const id = ins.rows[0].id;
  await tx.query(
    `INSERT INTO count_lines (session_id, item_id, piece_id, location_id, condition, recorded_qty)
     SELECT $1, b.item_id, b.piece_id, b.location_id, b.condition, sum(b.quantity)
       FROM stock_balances b JOIN locations l ON l.id = b.location_id JOIN warehouses w ON w.id = l.warehouse_id JOIN items i ON i.id = b.item_id
      WHERE b.condition IN ('available', 'reserved', 'damaged') AND b.quantity > 0 AND w.status = 'active'
        AND (cardinality($2::uuid[]) = 0 OR w.id = ANY($2::uuid[]))
        AND (cardinality($3::uuid[]) = 0 OR i.category_id = ANY($3::uuid[]) OR i.category_id IN (SELECT id FROM categories WHERE parent_id = ANY($3::uuid[])))
      GROUP BY b.item_id, b.piece_id, b.location_id, b.condition`,
    [id, o.warehouseIds, o.categoryIds]
  );
  for (const u of new Set(o.assigneeIds)) await tx.query('INSERT INTO count_session_assignees (session_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, u]);
  await emit(tx, 'count.due', { recordType: 'count_session', recordId: id, actorUserId: o.createdBy,
    payload: { sessionId: id, number, dueDate: o.dueDate, link: `/counts/${id}`, recipientIds: [...new Set(o.assigneeIds)] } });
  await writeAudit(tx, { action: 'count_session.created', actorUserId: o.createdBy, entityType: 'count_session', entityId: id, after: { number, dueDate: o.dueDate, scheduleId: o.scheduleId } });
  return id;
}

/** Ad-hoc count started by an Admin (US2). */
export async function startAdHoc(auth: Authenticated, input: { scope: { warehouseIds: string[]; categoryIds: string[] }; assigneeIds: string[]; blind: boolean }, ctx: RequestContext) {
  void ctx;
  return withTransaction(async (tx) => {
    await checkAssignees(tx, input.assigneeIds);
    const id = await createSession(tx, { scheduleId: null, dueDate: istDate(now()), blind: input.blind, ...input.scope, assigneeIds: input.assigneeIds, createdBy: auth.user.id });
    return { id: id! };
  });
}

/** 07:00 IST job (research R2): one session per schedule and due date, then the next due date. */
export async function createDueSessions(at: Date = now()): Promise<number> {
  const today = istDate(at);
  let created = 0;
  for (;;) {
    const made = await withTransaction(async (tx) => {
      const { rows } = await tx.query<{ id: string; frequency: Frequency; start: string; next: string; blind: boolean }>(
        `SELECT id, frequency, start_date::text AS start, next_due_date::text AS next, blind FROM count_schedules
          WHERE status = 'active' AND (next_due_date < $1 OR (next_due_date = $1 AND $2::boolean)) ORDER BY next_due_date LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [today, at >= istInstant(today, 7)]
      );
      const s = rows[0];
      if (!s) return false;
      const scope = await tx.query<{ warehouse_id: string | null; category_id: string | null }>('SELECT warehouse_id, category_id FROM count_schedule_scope WHERE schedule_id = $1', [s.id]);
      const people = await tx.query<{ user_id: string }>('SELECT user_id FROM count_schedule_assignees WHERE schedule_id = $1', [s.id]);
      const id = await createSession(tx, {
        scheduleId: s.id, dueDate: s.next, blind: s.blind, createdBy: null, assigneeIds: people.rows.map((p) => p.user_id),
        warehouseIds: scope.rows.filter((r) => r.warehouse_id).map((r) => r.warehouse_id!), categoryIds: scope.rows.filter((r) => r.category_id).map((r) => r.category_id!)
      });
      if (id) created++;
      await tx.query('UPDATE count_schedules SET next_due_date = $2 WHERE id = $1', [s.id, nextDueAfter(s.start, s.frequency, s.next)]);
      return true;
    });
    if (!made) return created;
  }
}

/** Daily escalation (US5): open sessions 3+ days past due, once per IST day, to Admins. */
export async function escalateOverdue(at: Date = now()): Promise<number> {
  const today = istDate(at);
  if (at < istInstant(today, 7)) return 0;
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ id: string; number: string; due: string }>(
      "SELECT id, number, due_date::text AS due FROM count_sessions WHERE status = 'open' AND due_date + 3 <= $1::date", [today]
    );
    let n = 0;
    for (const s of rows) {
      const ins = await tx.query('INSERT INTO count_escalations (session_id, day) VALUES ($1, $2) ON CONFLICT DO NOTHING', [s.id, today]);
      if (!ins.rowCount) continue;
      await emit(tx, 'count.overdue', { recordType: 'count_session', recordId: s.id, payload: { sessionId: s.id, number: s.number, dueDate: s.due, link: `/counts/${s.id}`, recipientIds: await adminIds(tx) } });
      n++;
    }
    return n;
  });
}

export async function listSessions(auth: Authenticated, q: { status?: string }): Promise<CountSessionRow[]> {
  const today = istDate(now());
  const { rows } = await getPool().query(
    `SELECT s.id, s.number, cs.name AS schedule_name, s.due_date::text AS due, s.blind, s.status, s.notes,
            (SELECT count(*)::int FROM count_lines l WHERE l.session_id = s.id) AS line_count,
            (SELECT count(*)::int FROM count_lines l WHERE l.session_id = s.id AND l.counted_qty IS NOT NULL) AS counted_count
       FROM count_sessions s LEFT JOIN count_schedules cs ON cs.id = s.schedule_id
      WHERE ($1::text IS NULL OR s.status = $1) AND ($2::boolean OR EXISTS (SELECT 1 FROM count_session_assignees a WHERE a.session_id = s.id AND a.user_id = $3))
      ORDER BY s.status = 'completed', s.due_date DESC, s.number DESC LIMIT 200`,
    [q.status ?? null, isAdmin(auth), auth.user.id]
  );
  return rows.map((r) => ({
    id: r.id, number: r.number, scheduleName: r.schedule_name, dueDate: r.due, blind: r.blind, status: r.status, lineCount: r.line_count, countedCount: r.counted_count,
    notes: r.notes, overdue: r.status === 'open' && r.due <= new Date(Date.parse(`${today}T00:00:00Z`) - 3 * 86_400_000).toISOString().slice(0, 10)
  }));
}
