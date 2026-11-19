import type { PoolClient } from 'pg';
import { now } from './clock';

type Db = Pick<PoolClient, 'query'>;

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60_000;
export const LOCK_MS = 15 * 60_000;

export interface LockState {
  locked: boolean;
  retryAt?: Date;
}

/**
 * Lock if ≥ 5 failures within 15 minutes, until 15 minutes after the 5th (FR-006). Known
 * accounts are keyed by user; unknown usernames by network address, so the generic error
 * cannot be used to probe for accounts.
 */
export async function lockState(db: Db, key: { userId: string | null; ip: string | null }): Promise<LockState> {
  const t = now();
  const since = new Date(t.getTime() - WINDOW_MS - LOCK_MS);
  const { rows } = key.userId
    ? await db.query<{ attempted_at: Date }>(
        `SELECT attempted_at FROM sign_in_attempts WHERE user_id = $1 AND NOT succeeded AND attempted_at > $2
         AND attempted_at > COALESCE((SELECT max(attempted_at) FROM sign_in_attempts WHERE user_id = $1 AND succeeded), '-infinity')
         ORDER BY attempted_at`,
        [key.userId, since]
      )
    : await db.query<{ attempted_at: Date }>(
        `SELECT attempted_at FROM sign_in_attempts WHERE user_id IS NULL AND network_address = $1 AND NOT succeeded AND attempted_at > $2
         ORDER BY attempted_at`,
        [key.ip, since]
      );
  const times = rows.map((r) => r.attempted_at.getTime());
  // Find the latest run of 5 failures that fits in a 15-minute window.
  for (let i = times.length - MAX_FAILURES; i >= 0; i--) {
    const first = times[i]!;
    const fifth = times[i + MAX_FAILURES - 1]!;
    if (fifth - first <= WINDOW_MS) {
      const retryAt = new Date(fifth + LOCK_MS);
      if (retryAt > t) return { locked: true, retryAt };
      break;
    }
  }
  return { locked: false };
}

export async function recordAttempt(
  db: Db,
  a: { username: string; userId: string | null; ip: string | null; succeeded: boolean }
): Promise<void> {
  await db.query(
    'INSERT INTO sign_in_attempts (username_attempted, user_id, network_address, succeeded, attempted_at) VALUES ($1, $2, $3, $4, $5)',
    [a.username, a.userId, a.ip, a.succeeded, now()]
  );
}
