import { normalisePhone, type Role } from '@artoholic/shared';
import { withTransaction, getPool } from '../../db/client';
import { ApiError } from '../http/errors';
import type { RequestContext } from '../http/context';
import { writeAudit } from '../audit/write';
import { verifyPassword } from './password';
import { lockState, recordAttempt } from './lockout';
import { createSession, type Authenticated } from './sessions';

interface Row {
  id: string;
  full_name: string;
  username: string;
  password_hash: string;
  status: string;
  must_change_password: boolean;
  roles: Role[] | null;
}

/**
 * Sign-in by username, email or phone plus password, with lockout and audit (001 FR-005–007,
 * 002 FR-006). Identifiers are unique across all three columns, so at most one account matches.
 */
export async function signIn(
  identifier: string,
  password: string,
  ctx: RequestContext
): Promise<{ token: string; auth: Authenticated }> {
  const pool = getPool();
  const username = identifier;
  const { rows } = await pool.query<Row>(
    `SELECT u.id, u.full_name, u.username, u.password_hash, u.status, u.must_change_password,
            array_remove(array_agg(r.role::text), NULL) AS roles
       FROM users u LEFT JOIN user_roles r ON r.user_id = u.id
      WHERE u.username = $1 OR u.email = $2::citext OR u.phone_e164 = $3
      GROUP BY u.id LIMIT 2`,
    [identifier, identifier.includes('@') ? identifier : null, normalisePhone(identifier)]
  );
  const user = rows.length === 1 ? rows[0] : undefined;
  const key = { userId: user?.id ?? null, ip: ctx.ip };

  const before = await lockState(pool, key);
  if (before.locked) throw new ApiError('SIGN_IN_LOCKED', { retryAt: before.retryAt!.toISOString() });

  const ok = (await verifyPassword(user?.password_hash ?? null, password)) && user?.status === 'active';
  if (!ok) {
    await recordAttempt(pool, { username, userId: user?.id ?? null, ip: ctx.ip, succeeded: false });
    await writeAudit(pool, {
      action: 'auth.sign_in_failed',
      actorUserId: user?.id ?? null,
      entityType: 'user',
      entityId: user?.id,
      after: { usernameAttempted: username },
      ctx
    });
    const after = await lockState(pool, key);
    if (after.locked) throw new ApiError('SIGN_IN_LOCKED', { retryAt: after.retryAt!.toISOString() });
    throw new ApiError('INVALID_CREDENTIALS');
  }

  return withTransaction(async (tx) => {
    await recordAttempt(tx, { username, userId: user.id, ip: ctx.ip, succeeded: true });
    const { token, session } = await createSession(tx, user.id, ctx);
    await writeAudit(tx, { action: 'auth.sign_in', actorUserId: user.id, entityType: 'session', entityId: session.id, ctx });
    return {
      token,
      auth: {
        user: { id: user.id, fullName: user.full_name, username: user.username, roles: user.roles ?? [], mustChangePassword: user.must_change_password },
        session
      }
    };
  });
}
