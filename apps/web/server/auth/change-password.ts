import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import type { RequestContext } from '../http/context';
import { writeAudit } from '../audit/write';
import { hashPassword, verifyPassword } from './password';
import { assertPasswordAllowed } from './policy';
import { revokeUserSessions, type Authenticated } from './sessions';
import { now } from './clock';

/** Changes the caller's password; other sessions end (002 FR-008, FR-013). */
export async function changePassword(auth: Authenticated, current: string, next: string, ctx: RequestContext): Promise<void> {
  const { rows } = await getPool().query<{ password_hash: string; username: string; email: string | null; phone_e164: string | null }>(
    'SELECT password_hash, username, email, phone_e164 FROM users WHERE id = $1',
    [auth.user.id]
  );
  const u = rows[0]!;
  if (!(await verifyPassword(u.password_hash, current))) throw new ApiError('INVALID_CREDENTIALS');
  assertPasswordAllowed(next, [u.username, u.email, u.phone_e164]);
  await withTransaction(async (tx) => {
    await tx.query(
      'UPDATE users SET password_hash = $2, must_change_password = false, password_changed_at = $3, updated_at = $3 WHERE id = $1',
      [auth.user.id, await hashPassword(next), now()]
    );
    await revokeUserSessions(tx, auth.user.id, auth.session.id);
    await writeAudit(tx, { action: 'auth.password_changed', actorUserId: auth.user.id, entityType: 'user', entityId: auth.user.id, ctx });
  });
}
