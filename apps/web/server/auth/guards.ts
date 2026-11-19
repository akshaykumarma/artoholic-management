import { hasPermission, type Permission } from '@artoholic/shared';
import { getPool } from '../../db/client';
import { ApiError } from '../http/errors';
import type { RequestContext } from '../http/context';
import { validateSession, type Authenticated } from './sessions';
import { SESSION_COOKIE } from './cookies';

/** Resolves the caller's session from the cookie (web) or bearer token (mobile). */
export async function requireSession(ctx: RequestContext): Promise<Authenticated> {
  const token = ctx.platform === 'web' ? ctx.cookies[SESSION_COOKIE] : ctx.bearer;
  if (!token) throw new ApiError('NOT_SIGNED_IN');
  return validateSession(getPool(), token, ctx.platform);
}

/** Server-side permission check on every handler (FR-009), independent of the menu. */
export function requirePermission(auth: Authenticated, permission: Permission): void {
  if (!hasPermission(auth.user.roles, permission)) throw new ApiError('FORBIDDEN');
}
