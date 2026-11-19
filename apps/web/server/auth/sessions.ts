import { createHash, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { ClientPlatform, Role } from '@artoholic/shared';
import { now } from './clock';
import { ApiError } from '../http/errors';

type Db = Pick<PoolClient, 'query'>;

const webIdleMinutes = () => Number(process.env.WEB_IDLE_MINUTES ?? 60);
const mobileDays = () => Number(process.env.MOBILE_SESSION_DAYS ?? 30);
const TOUCH_EVERY_MS = 60_000;

export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export interface SessionInfo {
  id: string;
  platform: ClientPlatform;
  expiresAt: Date;
  idleTimeoutMinutes: number | null;
}

export interface SessionUser {
  id: string;
  fullName: string;
  username: string;
  roles: Role[];
  mustChangePassword: boolean;
}

export interface Authenticated {
  user: SessionUser;
  session: SessionInfo;
}

/** Web: 60-minute sliding idle expiry. Mobile: fixed 30 days from sign-in (research R2). */
export async function createSession(
  db: Db,
  userId: string,
  ctx: { platform: ClientPlatform; version: string }
): Promise<{ token: string; session: SessionInfo }> {
  const token = randomBytes(32).toString('base64url');
  const t = now();
  const expiresAt =
    ctx.platform === 'web'
      ? new Date(t.getTime() + webIdleMinutes() * 60_000)
      : new Date(t.getTime() + mobileDays() * 24 * 60 * 60_000);
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO sessions (token_hash, user_id, client_platform, client_version, created_at, last_seen_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $5, $6) RETURNING id`,
    [hashToken(token), userId, ctx.platform, ctx.version, t, expiresAt]
  );
  return {
    token,
    session: { id: rows[0]!.id, platform: ctx.platform, expiresAt, idleTimeoutMinutes: ctx.platform === 'web' ? webIdleMinutes() : null }
  };
}

/**
 * Validates a token for the requesting app type. User status and roles are re-read on every
 * request, so deactivation and role changes apply at once (spec edge cases).
 */
export async function validateSession(db: Db, token: string, platform: ClientPlatform): Promise<Authenticated> {
  const isWeb = platform === 'web';
  const { rows } = await db.query<{
    id: string; user_id: string; client_platform: ClientPlatform; expires_at: Date; last_seen_at: Date; revoked_at: Date | null;
    full_name: string; username: string; status: string; roles: Role[] | null; must_change_password: boolean;
  }>(
    `SELECT s.id, s.user_id, s.client_platform, s.expires_at, s.last_seen_at, s.revoked_at,
            u.full_name, u.username, u.status, u.must_change_password,
            array_remove(array_agg(r.role::text), NULL) AS roles
       FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN user_roles r ON r.user_id = u.id
      WHERE s.token_hash = $1
      GROUP BY s.id, u.id`,
    [hashToken(token)]
  );
  const s = rows[0];
  if (!s || (s.client_platform === 'web') !== isWeb) throw new ApiError('NOT_SIGNED_IN');
  const t = now();
  if (s.revoked_at || s.expires_at <= t || s.status !== 'active') throw new ApiError('SESSION_EXPIRED');

  let expiresAt = s.expires_at;
  if (isWeb && t.getTime() - s.last_seen_at.getTime() >= TOUCH_EVERY_MS) {
    expiresAt = new Date(t.getTime() + webIdleMinutes() * 60_000);
    await db.query('UPDATE sessions SET last_seen_at = $2, expires_at = $3 WHERE id = $1', [s.id, t, expiresAt]);
  }
  return {
    user: { id: s.user_id, fullName: s.full_name, username: s.username, roles: s.roles ?? [], mustChangePassword: s.must_change_password },
    session: { id: s.id, platform: s.client_platform, expiresAt, idleTimeoutMinutes: isWeb ? webIdleMinutes() : null }
  };
}

export async function revokeSession(db: Db, sessionId: string): Promise<void> {
  await db.query('UPDATE sessions SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL', [sessionId, now()]);
}

/** Ends every session of a user, optionally keeping one (the caller's own). */
export async function revokeUserSessions(db: Db, userId: string, exceptSessionId?: string): Promise<void> {
  await db.query(
    'UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL AND ($3::uuid IS NULL OR id <> $3)',
    [userId, now(), exceptSessionId ?? null]
  );
}
