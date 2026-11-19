import type { PoolClient } from 'pg';
import { normalisePhone, t, type CreateUserInput, type Role, type UpdateUserInput, type User } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import type { RequestContext } from '../http/context';
import type { Authenticated } from '../auth/sessions';
import { revokeUserSessions } from '../auth/sessions';
import { hashPassword } from '../auth/password';
import { assertPasswordAllowed } from '../auth/policy';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import { USER_SELECT, toUser, type UserRow } from './map';

type Tx = Pick<PoolClient, 'query'>;
const USERS_LOCK = 427_002; // serialises identifier-uniqueness and last-Admin checks

const isSuper = (auth: Authenticated) => auth.user.roles.includes('super_admin');

function normalisedPhoneOrThrow(phone: string): string {
  const p = normalisePhone(phone);
  if (!p) throw new ApiError('VALIDATION_FAILED', { fields: { phone: 'Enter a valid phone number' } });
  return p;
}

/** Usernames, emails and phones are unique across all three columns of every account (002 FR-002). */
async function assertIdentifiersFree(tx: Tx, ids: { username?: string; email?: string | null; phone?: string }, exceptId: string | null) {
  for (const [field, value] of Object.entries(ids) as Array<[string, string | null | undefined]>) {
    if (!value) continue;
    const { rowCount } = await tx.query(
      `SELECT 1 FROM users WHERE ($2::uuid IS NULL OR id <> $2) AND (username = $1::citext OR email = $1::citext OR phone_e164 = $1)`,
      [value, exceptId]
    );
    if (rowCount) throw new ApiError('IDENTIFIER_TAKEN', { field }, t('error.IDENTIFIER_TAKEN', { field }));
  }
}

/** Only the Super Admin grants or removes Admin; nobody grants Super Admin through the app. */
function assertRoleChangeAllowed(auth: Authenticated, before: Role[], after: Role[]) {
  if (after.includes('super_admin') && !before.includes('super_admin')) throw new ApiError('FORBIDDEN');
  if (before.includes('super_admin') && !after.includes('super_admin')) throw new ApiError('FORBIDDEN');
  const touchesAdmin = before.includes('admin') !== after.includes('admin');
  if (touchesAdmin && !isSuper(auth)) throw new ApiError('SUPER_ADMIN_ONLY');
}

/** Editing an Admin (or the Super Admin) account is Super-Admin-only (002 FR-005). */
function assertMayEdit(auth: Authenticated, target: User) {
  if (target.roles.includes('super_admin') && target.id !== auth.user.id) throw new ApiError('SUPER_ADMIN_ONLY');
  if (target.roles.includes('admin') && !isSuper(auth)) throw new ApiError('SUPER_ADMIN_ONLY');
}

async function activeAdmins(tx: Tx): Promise<number> {
  const { rows } = await tx.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM users u JOIN user_roles r ON r.user_id = u.id WHERE r.role = 'admin' AND u.status = 'active'"
  );
  return rows[0]!.n;
}

async function loadUser(tx: Tx, id: string, forUpdate = false): Promise<User> {
  const { rows } = await tx.query<UserRow>(`${USER_SELECT} WHERE u.id = $1${forUpdate ? ' FOR UPDATE OF u' : ''}`, [id]);
  if (!rows[0]) throw new ApiError('NOT_FOUND');
  return toUser(rows[0]);
}

async function setRoles(tx: Tx, userId: string, roles: Role[]) {
  await tx.query('DELETE FROM user_roles WHERE user_id = $1 AND NOT (role = ANY($2::role[]))', [userId, roles]);
  for (const role of roles) {
    await tx.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, role]);
  }
}

/** Keeps assignment history: ends removed assignments, adds new ones (002 FR-004). */
async function syncWarehouses(tx: Tx, userId: string, warehouseIds: string[], actorId: string) {
  await tx.query(
    'UPDATE warehouse_assignments SET unassigned_at = $3, unassigned_by = $4 WHERE user_id = $1 AND unassigned_at IS NULL AND NOT (warehouse_id = ANY($2::uuid[]))',
    [userId, warehouseIds, now(), actorId]
  );
  for (const wh of warehouseIds) {
    await tx.query(
      `INSERT INTO warehouse_assignments (user_id, warehouse_id, assigned_by) SELECT $1, $2, $3
       WHERE NOT EXISTS (SELECT 1 FROM warehouse_assignments WHERE user_id = $1 AND warehouse_id = $2 AND unassigned_at IS NULL)`,
      [userId, wh, actorId]
    );
  }
}

const auditView = (u: User) => ({ fullName: u.fullName, phone: u.phone, email: u.email, username: u.username, roles: u.roles, warehouseIds: u.warehouseIds, status: u.status });

export async function createUser(auth: Authenticated, input: CreateUserInput, ctx: RequestContext): Promise<User> {
  assertRoleChangeAllowed(auth, [], input.roles);
  const phone = normalisedPhoneOrThrow(input.phone);
  const email = input.email?.toLowerCase() ?? null;
  const username = input.username ?? email ?? phone;
  assertPasswordAllowed(input.temporaryPassword, [username, email, phone]);
  return withTransaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock($1)', [USERS_LOCK]);
    // Phone and email first: a defaulted username is derived from them, so name the field the Admin typed.
    await assertIdentifiersFree(tx, { phone, email, username }, null);
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO users (full_name, username, phone_e164, email, password_hash, must_change_password)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
      [input.fullName, username, phone, email, await hashPassword(input.temporaryPassword)]
    );
    const id = rows[0]!.id;
    await setRoles(tx, id, input.roles);
    if (input.roles.includes('store_manager')) await syncWarehouses(tx, id, input.warehouseIds ?? [], auth.user.id);
    const user = await loadUser(tx, id);
    await writeAudit(tx, { action: 'user.created', actorUserId: auth.user.id, entityType: 'user', entityId: id, after: auditView(user), ctx });
    return user;
  });
}

export async function updateUser(auth: Authenticated, id: string, ifMatch: string | null, input: UpdateUserInput, ctx: RequestContext): Promise<User> {
  return withTransaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock($1)', [USERS_LOCK]);
    const before = await loadUser(tx, id, true);
    assertMayEdit(auth, before);
    if (!ifMatch || new Date(ifMatch).getTime() !== new Date(before.updatedAt).getTime()) {
      throw new ApiError('STALE_VERSION', { updatedAt: before.updatedAt });
    }
    const roles = input.roles ?? before.roles;
    assertRoleChangeAllowed(auth, before.roles, roles);
    const phone = input.phone !== undefined ? normalisedPhoneOrThrow(input.phone) : before.phone;
    const email = input.email !== undefined ? input.email?.toLowerCase() ?? null : before.email;
    const username = input.username ?? before.username;
    await assertIdentifiersFree(
      tx,
      { username: username !== before.username ? username : undefined, email: email !== before.email ? email : undefined, phone: phone !== before.phone ? phone ?? undefined : undefined },
      id
    );
    const adminsBefore = await activeAdmins(tx);
    await tx.query(
      'UPDATE users SET full_name = $2, phone_e164 = $3, email = $4, username = $5, updated_at = $6 WHERE id = $1',
      [id, input.fullName ?? before.fullName, phone, email, username, now()]
    );
    await setRoles(tx, id, roles);
    const warehouses = roles.includes('store_manager') ? input.warehouseIds ?? before.warehouseIds : [];
    await syncWarehouses(tx, id, warehouses, auth.user.id);
    if (adminsBefore > 0 && (await activeAdmins(tx)) === 0) throw new ApiError('LAST_ADMIN');
    const after = await loadUser(tx, id);
    await writeAudit(tx, { action: 'user.updated', actorUserId: auth.user.id, entityType: 'user', entityId: id, before: auditView(before), after: auditView(after), ctx });
    return after;
  });
}

export async function setTemporaryPassword(auth: Authenticated, id: string, temporaryPassword: string, ctx: RequestContext): Promise<void> {
  await withTransaction(async (tx) => {
    const target = await loadUser(tx, id, true);
    assertMayEdit(auth, target);
    assertPasswordAllowed(temporaryPassword, [target.username, target.email, target.phone]);
    await tx.query('UPDATE users SET password_hash = $2, must_change_password = true, updated_at = $3 WHERE id = $1', [id, await hashPassword(temporaryPassword), now()]);
    await revokeUserSessions(tx, id);
    await writeAudit(tx, { action: 'user.temp_password_set', actorUserId: auth.user.id, entityType: 'user', entityId: id, ctx });
  });
}

export async function deactivateUser(auth: Authenticated, id: string, reason: string, ctx: RequestContext): Promise<void> {
  if (id === auth.user.id) throw new ApiError('SELF_DEACTIVATION');
  await withTransaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock($1)', [USERS_LOCK]);
    const target = await loadUser(tx, id, true);
    assertMayEdit(auth, target);
    if (target.status === 'deactivated') return;
    const adminsBefore = await activeAdmins(tx);
    const t0 = now();
    await tx.query("UPDATE users SET status = 'deactivated', deactivated_at = $2, deactivated_by = $3, updated_at = $2 WHERE id = $1", [id, t0, auth.user.id]);
    if (adminsBefore > 0 && (await activeAdmins(tx)) === 0) throw new ApiError('LAST_ADMIN');
    await revokeUserSessions(tx, id);
    await writeAudit(tx, { action: 'user.deactivated', actorUserId: auth.user.id, entityType: 'user', entityId: id, after: { reason }, ctx });
  });
}

export async function reactivateUser(auth: Authenticated, id: string, temporaryPassword: string, ctx: RequestContext): Promise<void> {
  await withTransaction(async (tx) => {
    const target = await loadUser(tx, id, true);
    assertMayEdit(auth, target);
    assertPasswordAllowed(temporaryPassword, [target.username, target.email, target.phone]);
    await tx.query(
      "UPDATE users SET status = 'active', deactivated_at = NULL, deactivated_by = NULL, password_hash = $2, must_change_password = true, updated_at = $3 WHERE id = $1",
      [id, await hashPassword(temporaryPassword), now()]
    );
    await writeAudit(tx, { action: 'user.reactivated', actorUserId: auth.user.id, entityType: 'user', entityId: id, ctx });
  });
}

export async function getUser(id: string): Promise<User> {
  return loadUser(getPool(), id);
}

export interface UserQuery {
  q?: string;
  role?: Role;
  status?: 'active' | 'deactivated';
  warehouseId?: string;
  cursor?: number;
}

/** Search by name, username, phone and email; filter by role, status, warehouse (002 FR-015). */
export async function listUsers(query: UserQuery): Promise<{ items: User[]; nextCursor: string | null }> {
  const limit = 50;
  const offset = query.cursor ?? 0;
  const q = query.q?.trim() || null;
  const digits = q?.replace(/\D/g, '') || null;
  const { rows } = await getPool().query<UserRow>(
    `${USER_SELECT}
     WHERE ($1::text IS NULL OR u.full_name ILIKE '%' || $1 || '%' OR u.username ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%'
            OR ($2::text IS NOT NULL AND length($2) >= 4 AND u.phone_e164 LIKE '%' || $2 || '%'))
       AND ($3::role IS NULL OR EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = $3))
       AND ($4::user_status IS NULL OR u.status = $4)
       AND ($5::uuid IS NULL OR EXISTS (SELECT 1 FROM warehouse_assignments w WHERE w.user_id = u.id AND w.warehouse_id = $5 AND w.unassigned_at IS NULL))
     ORDER BY u.full_name, u.id
     LIMIT ${limit + 1} OFFSET $6`,
    [q, digits, query.role ?? null, query.status ?? null, query.warehouseId ?? null, offset]
  );
  const items = rows.slice(0, limit).map(toUser);
  return { items, nextCursor: rows.length > limit ? String(offset + limit) : null };
}
