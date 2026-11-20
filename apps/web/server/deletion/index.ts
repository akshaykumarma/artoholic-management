import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { emit } from '../notifications/outbox';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';

const DAYS_30 = 30 * 86_400_000;

/** In-app "Request account deletion" (011 US5): Admins are told; done within 30 days. */
export async function requestDeletion(auth: Authenticated, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const { rows: open } = await tx.query<{ id: string; due_at: Date }>("SELECT id, due_at FROM account_deletion_requests WHERE user_id = $1 AND status = 'pending'", [auth.user.id]);
    if (open[0]) return { id: open[0].id, dueAt: new Date(open[0].due_at).toISOString(), alreadyRequested: true };
    const due = new Date(now().getTime() + DAYS_30);
    const { rows } = await tx.query<{ id: string }>('INSERT INTO account_deletion_requests (user_id, requested_at, due_at) VALUES ($1, $2, $3) RETURNING id', [auth.user.id, now(), due]);
    await emit(tx, 'account.deletion_requested', { recordType: 'user', recordId: auth.user.id, actorUserId: auth.user.id,
      payload: { name: auth.user.fullName, due: due.toISOString().slice(0, 10) } });
    await writeAudit(tx, { action: 'account.deletion_requested', actorUserId: auth.user.id, entityType: 'user', entityId: auth.user.id, after: { requestId: rows[0]!.id, dueAt: due.toISOString() }, ctx });
    return { id: rows[0]!.id, dueAt: due.toISOString(), alreadyRequested: false };
  });
}

export async function listDeletionRequests() {
  const { rows } = await getPool().query(
    `SELECT r.*, u.full_name FROM account_deletion_requests r JOIN users u ON u.id = r.user_id ORDER BY r.status = 'pending' DESC, r.due_at`
  );
  return rows.map((r) => ({ id: r.id, userId: r.user_id, userName: r.full_name, requestedAt: new Date(r.requested_at).toISOString(), dueAt: new Date(r.due_at).toISOString(),
    status: r.status, completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null }));
}

/**
 * Completes a request (011 R5): deactivate, end sessions, drop push tokens, and replace name, phone,
 * email and username with a pseudonym. Every past action keeps the same user id, so the audit trail
 * stays intact and now reads "Former user #…" everywhere.
 */
export async function completeDeletion(auth: Authenticated, id: string, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ user_id: string }>("SELECT user_id FROM account_deletion_requests WHERE id = $1 AND status = 'pending' FOR UPDATE", [id]);
    const r = rows[0];
    if (!r) throw new ApiError('NOT_FOUND');
    const { rows: roles } = await tx.query<{ role: string }>('SELECT role FROM user_roles WHERE user_id = $1', [r.user_id]);
    if (roles.some((x) => x.role === 'super_admin')) throw new ApiError('VALIDATION_FAILED', { fields: { user: 'Hand the Super Admin role to someone else first' } });
    const short = r.user_id.slice(0, 8);
    const pseudonym = `Former user #${short}`;
    await tx.query(
      `UPDATE users SET full_name = $2, username = $3, phone_e164 = NULL, email = NULL, status = 'deactivated', pseudonymised_at = $4,
         password_hash = 'pseudonymised' WHERE id = $1`,
      [r.user_id, pseudonym, `former-${short}`, now()]
    );
    await tx.query('UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL', [r.user_id, now()]);
    await tx.query('DELETE FROM push_registrations WHERE user_id = $1', [r.user_id]);
    await tx.query('DELETE FROM channel_preferences WHERE user_id = $1', [r.user_id]);
    await tx.query('DELETE FROM quiet_hours WHERE user_id = $1', [r.user_id]);
    await tx.query('UPDATE warehouse_assignments SET unassigned_at = $2, unassigned_by = $3 WHERE user_id = $1 AND unassigned_at IS NULL', [r.user_id, now(), auth.user.id]);
    await tx.query("UPDATE account_deletion_requests SET status = 'completed', completed_by = $2, completed_at = $3 WHERE id = $1", [id, auth.user.id, now()]);
    await writeAudit(tx, { action: 'account.pseudonymised', actorUserId: auth.user.id, entityType: 'user', entityId: r.user_id, after: { requestId: id, pseudonym }, ctx });
    return { userId: r.user_id, pseudonym };
  });
}
