import { getPool } from '../../db/client';

/** Extra status figures (010 US7): queue length, failed messages, storage, last backup, app versions in use. */
export async function extendedStatus() {
  const pool = getPool();
  const queue = (await pool.query<{ t: string | null }>("SELECT to_regclass('pgboss.job')::text AS t")).rows[0]?.t
    ? Number((await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM pgboss.job WHERE state IN ('created', 'retry', 'active')")).rows[0]!.n)
    : 0;
  const pending = Number((await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM channel_jobs WHERE status = 'pending'")).rows[0]!.n);
  const failed = Number((await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM messages WHERE status = 'failed' AND queued_at > now() - interval '24 hours'")).rows[0]!.n);
  const used = Number((await pool.query<{ n: string }>(
    `SELECT (COALESCE((SELECT sum(bytes) FROM damage_photos WHERE deleted_at IS NULL), 0) + COALESCE((SELECT sum(file_bytes) FROM report_runs), 0))::text AS n`
  )).rows[0]!.n);
  const b = (await pool.query("SELECT started_at, status, database_bytes FROM backup_records WHERE status <> 'running' ORDER BY started_at DESC LIMIT 1")).rows[0];
  const versions = (await pool.query<{ platform: string; version: string; n: number }>(
    `SELECT client_platform::text AS platform, client_version AS version, count(*)::int AS n FROM sessions
      WHERE revoked_at IS NULL AND expires_at > now() GROUP BY 1, 2 ORDER BY 1, 2`
  )).rows;
  const quota = process.env.STORAGE_QUOTA_GB ? Number(process.env.STORAGE_QUOTA_GB) * 1024 ** 3 : null;
  return {
    jobQueue: queue + pending,
    failedMessages24h: failed,
    storage: { usedBytes: used, quotaBytes: quota },
    lastBackup: b ? { at: new Date(b.started_at).toISOString(), status: b.status, bytes: b.database_bytes === null ? null : Number(b.database_bytes) } : null,
    appVersions: versions.map((v) => ({ platform: v.platform, version: v.version, sessions: v.n }))
  };
}
