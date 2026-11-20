import type { PoolClient } from 'pg';
import { istDate, istInstant, REPORTS, type ReportFilters, type ReportId, type ReportSchedule } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { emit } from '../notifications/outbox';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import { logger } from '../http/logger';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';
import { exportReport } from './run';

type Tx = Pick<PoolClient, 'query'>;

async function view(db: Tx, id: string): Promise<ReportSchedule> {
  const { rows } = await db.query('SELECT * FROM report_schedules WHERE id = $1', [id]);
  const s = rows[0];
  if (!s) throw new ApiError('NOT_FOUND');
  const people = await db.query<{ id: string; full_name: string }>('SELECT u.id, u.full_name FROM report_schedule_recipients r JOIN users u ON u.id = r.user_id WHERE r.schedule_id = $1 ORDER BY u.full_name', [id]);
  const last = await db.query<{ status: string; finished_at: Date | null }>('SELECT status, finished_at FROM report_runs WHERE schedule_id = $1 ORDER BY started_at DESC LIMIT 1', [id]);
  return {
    id: s.id, reportId: s.report_id, name: s.name, filters: s.filters, frequency: s.frequency, weekday: s.weekday, monthDay: s.month_day, timeIst: s.time_ist, status: s.status,
    recipients: people.rows.map((p) => ({ id: p.id, fullName: p.full_name })),
    lastRun: last.rows[0] ? { status: last.rows[0].status, finishedAt: last.rows[0].finished_at ? new Date(last.rows[0].finished_at).toISOString() : null } : null
  };
}

export async function listSchedules(): Promise<ReportSchedule[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM report_schedules ORDER BY name');
  return Promise.all(rows.map((r) => view(pool, r.id)));
}

/** Recipients must be active Admins (owner decision Q13). */
async function setRecipients(tx: Tx, id: string, ids: string[]) {
  const { rows } = await tx.query<{ id: string }>(
    "SELECT DISTINCT u.id FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role IN ('admin', 'super_admin') WHERE u.id = ANY($1::uuid[]) AND u.status = 'active'", [ids]
  );
  if (rows.length !== new Set(ids).size) throw new ApiError('RECIPIENT_NOT_ADMIN', { userIds: ids.filter((x) => !rows.some((r) => r.id === x)) });
  await tx.query('DELETE FROM report_schedule_recipients WHERE schedule_id = $1', [id]);
  for (const u of new Set(ids)) await tx.query('INSERT INTO report_schedule_recipients (schedule_id, user_id) VALUES ($1, $2)', [id, u]);
}

export async function createSchedule(auth: Authenticated, input: { reportId: ReportId; name: string; filters: ReportFilters; frequency: 'daily' | 'weekly' | 'monthly'; weekday?: number; monthDay?: number; timeIst: string; recipientIds: string[] }, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO report_schedules (report_id, name, filters, frequency, weekday, month_day, time_ist, owner_user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [input.reportId, input.name, JSON.stringify(input.filters), input.frequency, input.frequency === 'weekly' ? input.weekday : null, input.frequency === 'monthly' ? input.monthDay : null, input.timeIst, auth.user.id]
    );
    await setRecipients(tx, rows[0]!.id, input.recipientIds);
    const after = await view(tx, rows[0]!.id);
    await writeAudit(tx, { action: 'report_schedule.created', actorUserId: auth.user.id, entityType: 'report_schedule', entityId: after.id, after, ctx });
    return after;
  });
}

export async function updateSchedule(auth: Authenticated, id: string, input: Partial<{ name: string; filters: ReportFilters; timeIst: string; weekday: number; monthDay: number; recipientIds: string[]; status: 'active' | 'paused' }>, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const before = await view(tx, id);
    await tx.query(
      `UPDATE report_schedules SET name = COALESCE($2, name), filters = COALESCE($3, filters), time_ist = COALESCE($4, time_ist), weekday = COALESCE($5, weekday),
         month_day = COALESCE($6, month_day), status = COALESCE($7, status), updated_at = $8 WHERE id = $1`,
      [id, input.name ?? null, input.filters ? JSON.stringify(input.filters) : null, input.timeIst ?? null, input.weekday ?? null, input.monthDay ?? null, input.status ?? null, now()]
    );
    if (input.recipientIds) await setRecipients(tx, id, input.recipientIds);
    const after = await view(tx, id);
    await writeAudit(tx, { action: 'report_schedule.updated', actorUserId: auth.user.id, entityType: 'report_schedule', entityId: id, before, after, ctx });
    return after;
  });
}

export async function deleteSchedule(auth: Authenticated, id: string, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    const before = await view(tx, id);
    await tx.query('DELETE FROM report_schedules WHERE id = $1', [id]);
    await writeAudit(tx, { action: 'report_schedule.deleted', actorUserId: auth.user.id, entityType: 'report_schedule', entityId: id, before, ctx });
  });
}

export async function scheduleRuns(id: string) {
  const { rows } = await getPool().query(
    `SELECT r.id, r.status, r.started_at, r.finished_at, r.row_count, r.file_name, r.error,
            COALESCE((SELECT json_agg(json_build_object('channel', m.channel, 'to', m.to_address, 'status', m.status)) FROM messages m WHERE m.record_type = 'report_run' AND m.record_id = r.id::text), '[]') AS deliveries
       FROM report_runs r WHERE r.schedule_id = $1 ORDER BY r.started_at DESC LIMIT 50`, [id]
  );
  return rows.map((r) => ({ id: r.id, status: r.status, startedAt: new Date(r.started_at).toISOString(), finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
    rowCount: r.row_count, fileName: r.file_name, error: r.error, deliveries: r.deliveries }));
}

/** Does the schedule run on this IST date? Monthly on the 31st runs on the month's last day (US2-1). */
export function runsOn(s: { frequency: string; weekday: number | null; month_day: number | null }, date: string): boolean {
  if (s.frequency === 'daily') return true;
  const d = new Date(`${date}T00:00:00Z`);
  if (s.frequency === 'weekly') return ((d.getUTCDay() + 6) % 7) + 1 === s.weekday;
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return d.getUTCDate() === Math.min(s.month_day ?? 1, last);
}

/**
 * Minute job (research R3): runs due schedules once per IST day, never two at once for a schedule
 * (a running run makes the next wait), then delivers the file to each Admin recipient via 008.
 */
export async function runDueSchedules(at: Date = now()): Promise<number> {
  const today = istDate(at);
  const pool = getPool();
  const { rows } = await pool.query<{ id: string; report_id: ReportId; name: string; filters: ReportFilters; frequency: string; weekday: number | null; month_day: number | null; time_ist: string; owner_user_id: string }>(
    "SELECT * FROM report_schedules WHERE status = 'active'"
  );
  let ran = 0;
  for (const s of rows) {
    const [hh, mm] = s.time_ist.split(':').map(Number) as [number, number];
    if (!runsOn(s, today) || at < istInstant(today, hh, mm)) continue;
    const claimed = await withTransaction(async (tx) => {
      await tx.query('SELECT 1 FROM report_schedules WHERE id = $1 FOR UPDATE', [s.id]);
      if ((await tx.query("SELECT 1 FROM report_runs WHERE schedule_id = $1 AND status = 'running'", [s.id])).rowCount) return null;
      const ins = await tx.query<{ id: string }>(
        `INSERT INTO report_runs (report_id, schedule_id, run_date, filters, started_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (schedule_id, run_date) WHERE schedule_id IS NOT NULL DO NOTHING RETURNING id`, [s.report_id, s.id, today, JSON.stringify(s.filters), at]
      );
      return ins.rows[0]?.id ?? null;
    });
    if (!claimed) continue;
    try {
      const file = await exportReport({ auth: null, reportId: s.report_id, filters: s.filters, runId: claimed });
      await withTransaction(async (tx) => {
        // Recipients who are no longer active Admins are dropped and the owner is told (edge case).
        const { rows: rec } = await tx.query<{ user_id: string; full_name: string; ok: boolean }>(
          `SELECT r.user_id, u.full_name, (u.status = 'active' AND EXISTS (SELECT 1 FROM user_roles x WHERE x.user_id = u.id AND x.role IN ('admin', 'super_admin'))) AS ok
             FROM report_schedule_recipients r JOIN users u ON u.id = r.user_id WHERE r.schedule_id = $1`, [s.id]
        );
        for (const r of rec.filter((x) => !x.ok)) {
          await tx.query('DELETE FROM report_schedule_recipients WHERE schedule_id = $1 AND user_id = $2', [s.id, r.user_id]);
          await emit(tx, 'report.recipient_removed', { recordType: 'report_schedule', recordId: s.id, payload: { user: r.full_name, name: s.name, recipientIds: [s.owner_user_id] } });
        }
        await emit(tx, 'report.ready', { recordType: 'report_run', recordId: claimed, payload: {
          runId: claimed, name: s.name, period: `${REPORTS[s.report_id].title} · ${today}`, fileKey: file.key, fileName: file.fileName, fileBytes: file.bytes,
          downloadPath: `/api/v1/reports/runs/${claimed}/download`, link: '/reports', recipientIds: rec.filter((x) => x.ok).map((x) => x.user_id)
        } });
      });
      ran++;
    } catch (err) {
      logger.error('scheduled report failed', { scheduleId: s.id, error: (err as Error).message });
    }
  }
  return ran;
}
