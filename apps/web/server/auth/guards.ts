import { hasPermission, type Permission } from '@artoholic/shared';
import { getPool } from '../../db/client';
import { ApiError } from '../http/errors';
import type { RequestContext } from '../http/context';
import { validateSession, type Authenticated } from './sessions';
import { SESSION_COOKIE } from './cookies';

/**
 * Resolves the caller's session from the cookie (web) or bearer token (mobile). While a temporary
 * password is unchanged, only endpoints that opt in (me, sign-out, change-password) work (002 FR-008).
 */
export async function requireSession(ctx: RequestContext, opts: { allowPasswordChange?: boolean } = {}): Promise<Authenticated> {
  const token = ctx.platform === 'web' ? ctx.cookies[SESSION_COOKIE] : ctx.bearer;
  if (!token) throw new ApiError('NOT_SIGNED_IN');
  const auth = await validateSession(getPool(), token, ctx.platform);
  if (auth.user.mustChangePassword && !opts.allowPasswordChange) throw new ApiError('PASSWORD_CHANGE_REQUIRED');
  return auth;
}

/** Server-side permission check on every handler (FR-009), independent of the menu. */
export function requirePermission(auth: Authenticated, permission: Permission): void {
  if (!hasPermission(auth.user.roles, permission)) throw new ApiError('FORBIDDEN');
}

/** "Assigned only" cells (002 matrix): Store Managers act only on warehouses assigned to them. */
export async function requireWarehouseScope(auth: Authenticated, warehouseId: string): Promise<void> {
  const roles = auth.user.roles;
  if (roles.includes('super_admin') || roles.includes('admin')) return;
  if (roles.includes('store_manager')) {
    const { rowCount } = await getPool().query(
      'SELECT 1 FROM warehouse_assignments WHERE user_id = $1 AND warehouse_id = $2 AND unassigned_at IS NULL',
      [auth.user.id, warehouseId]
    );
    if (rowCount) return;
  }
  throw new ApiError('FORBIDDEN');
}
