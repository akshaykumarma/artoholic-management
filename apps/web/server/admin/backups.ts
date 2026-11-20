import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { istDate } from '@artoholic/shared';
import { getPool } from '../../db/client';
import { ApiError } from '../http/errors';
import { emit } from '../notifications/outbox';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import { logger } from '../http/logger';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';

const run = promisify(execFile);

async function superAdmins(): Promise<string[]> {
  const { rows } = await getPool().query<{ id: string }>("SELECT u.id FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'super_admin' WHERE u.status = 'active'");
  return rows.map((r) => r.id);
}

/**
 * 02:00 IST backup (010 US5, research R2): runs BACKUP_COMMAND (deploy/backup/backup.sh: pg_dump + rclone
 * to the off-server bucket, 30-day lifecycle), which prints a JSON summary. Failure → Super Admin, in-app and email.
 */
export async function runBackup(command = process.env.BACKUP_COMMAND): Promise<{ id: string; status: string }> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>('INSERT INTO backup_records (started_at) VALUES ($1) RETURNING id', [now()]);
  const id = rows[0]!.id;
  const fail = async (status: 'failed' | 'skipped', error: string) => {
    await pool.query('UPDATE backup_records SET status = $2, finished_at = $3, error = $4 WHERE id = $1', [id, status, now(), error.slice(0, 1000)]);
    if (status === 'failed') {
      await emit(pool, 'backup.failed', { recordType: 'backup', recordId: id, payload: { error: error.slice(0, 200), recipientIds: await superAdmins() } });
      logger.error('backup failed', { error });
    }
    return { id, status };
  };
  if (!command) return fail(process.env.NODE_ENV === 'production' ? 'failed' : 'skipped', 'BACKUP_COMMAND is not configured');
  try {
    const { stdout } = await run('/bin/sh', ['-c', command], { timeout: 3 * 3600_000, maxBuffer: 1024 * 1024 });
    const last = stdout.trim().split('\n').pop() ?? '{}';
    const s = JSON.parse(last) as { databaseBytes?: number; filesSynced?: number; location?: string };
    await pool.query("UPDATE backup_records SET status = 'succeeded', finished_at = $2, database_bytes = $3, files_synced = $4, location = $5 WHERE id = $1",
      [id, now(), s.databaseBytes ?? null, s.filesSynced ?? null, s.location ?? null]);
    return { id, status: 'succeeded' };
  } catch (err) {
    return fail('failed', (err as Error).message);
  }
}

/** Quarterly restore test reminder: none recorded for 100 days → Super Admin, once a day (US5-2). */
export async function remindRestoreTest(at: Date = now()): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query<{ last: Date | null }>('SELECT max(performed_at) AS last FROM restore_tests');
  const since = rows[0]?.last ? (at.getTime() - new Date(rows[0].last).getTime()) / 86_400_000 : Infinity;
  if (since < 100) return false;
  const ins = await pool.query('INSERT INTO console_reminders (kind, day) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['restore_test', istDate(at)]);
  if (!ins.rowCount) return false;
  await emit(pool, 'backup.restore_test_due', { recordType: 'restore_test', payload: { days: Number.isFinite(since) ? Math.floor(since) : 100, recipientIds: await superAdmins() } });
  return true;
}

export async function listBackups() {
  const pool = getPool();
  const b = await pool.query('SELECT * FROM backup_records ORDER BY started_at DESC LIMIT 60');
  const r = await pool.query('SELECT t.*, u.full_name FROM restore_tests t JOIN users u ON u.id = t.performed_by ORDER BY performed_at DESC LIMIT 20');
  return {
    backups: b.rows.map((x) => ({ id: x.id, startedAt: new Date(x.started_at).toISOString(), finishedAt: x.finished_at ? new Date(x.finished_at).toISOString() : null,
      databaseBytes: x.database_bytes === null ? null : Number(x.database_bytes), filesSynced: x.files_synced, location: x.location, status: x.status, error: x.error })),
    restoreTests: r.rows.map((x) => ({ id: x.id, performedAt: new Date(x.performed_at).toISOString(), by: x.full_name, result: x.result, rpoHours: x.observed_rpo_hours, rtoHours: x.observed_rto_hours, notes: x.notes }))
  };
}

export async function recordRestoreTest(auth: Authenticated, input: { performedAt: string; backupRecordId?: string; rpoHours?: number; rtoHours?: number; result: 'passed' | 'failed'; notes?: string }, ctx: RequestContext) {
  if (Date.parse(input.performedAt) > now().getTime() + 60_000) throw new ApiError('VALIDATION_FAILED', { fields: { performedAt: 'The test date cannot be in the future' } });
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO restore_tests (performed_at, performed_by, backup_record_id, observed_rpo_hours, observed_rto_hours, result, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [input.performedAt, auth.user.id, input.backupRecordId ?? null, input.rpoHours ?? null, input.rtoHours ?? null, input.result, input.notes ?? '']
  );
  await writeAudit(getPool(), { action: 'backup.restore_test_recorded', actorUserId: auth.user.id, entityType: 'restore_test', entityId: rows[0]!.id, after: input, ctx });
  return { id: rows[0]!.id };
}
