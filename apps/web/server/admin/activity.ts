import { getPool } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import { revokeSession, type Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';

/** Sign-ins and failed sign-ins from the audit log (010 US2). */
export async function signIns(q: { userId?: string; from?: string; to?: string }) {
  const { rows } = await getPool().query(
    `SELECT a.occurred_at, a.action, COALESCE(u.full_name, a.after->>'identifier') AS who, a.client_platform, host(a.network_address) AS ip
       FROM audit_entries a LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE a.action IN ('auth.sign_in', 'auth.sign_in_failed') AND ($1::uuid IS NULL OR a.actor_user_id = $1)
        AND ($2::date IS NULL OR a.occurred_at >= $2::date - interval '330 minutes') AND ($3::date IS NULL OR a.occurred_at < $3::date + 1 - interval '330 minutes')
      ORDER BY a.id DESC LIMIT 500`,
    [q.userId ?? null, q.from ?? null, q.to ?? null]
  );
  return rows.map((r) => ({ at: new Date(r.occurred_at).toISOString(), result: r.action === 'auth.sign_in' ? 'success' : 'failed', who: r.who, platform: r.client_platform, ip: r.ip }));
}

/** Active sessions by device, each of which the Super Admin can end (US2-1). */
export async function activeSessions(userId?: string) {
  const { rows } = await getPool().query(
    `SELECT s.id, u.full_name, s.client_platform AS platform, s.client_version, s.created_at, s.last_seen_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.revoked_at IS NULL AND s.expires_at > now() AND ($1::uuid IS NULL OR s.user_id = $1)
      ORDER BY s.last_seen_at DESC LIMIT 500`, [userId ?? null]
  );
  return rows.map((r) => ({ id: r.id, user: r.full_name, platform: r.platform, startedAt: new Date(r.created_at).toISOString(), lastSeenAt: new Date(r.last_seen_at).toISOString(), expiresAt: new Date(r.expires_at).toISOString() }));
}

export async function endSession(auth: Authenticated, id: string, ctx: RequestContext) {
  const { rows } = await getPool().query<{ user_id: string }>('SELECT user_id FROM sessions WHERE id = $1 AND revoked_at IS NULL', [id]);
  if (!rows[0]) throw new ApiError('NOT_FOUND');
  await revokeSession(getPool(), id);
  await getPool().query('DELETE FROM push_registrations WHERE session_id = $1', [id]);
  await writeAudit(getPool(), { action: 'auth.session_ended_by_admin', actorUserId: auth.user.id, entityType: 'session', entityId: id, after: { userId: rows[0].user_id }, ctx });
  return { ended: true };
}
