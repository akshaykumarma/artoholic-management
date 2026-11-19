import type { PoolClient } from 'pg';

export const HEARTBEAT_JOB = 'system-heartbeat';

export async function beat(db: Pick<PoolClient, 'query'>): Promise<void> {
  await db.query(
    "INSERT INTO system_heartbeats (name, last_beat_at) VALUES ('jobs', now()) ON CONFLICT (name) DO UPDATE SET last_beat_at = now()"
  );
}
