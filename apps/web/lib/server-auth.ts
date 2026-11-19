import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { hasPermission, type Permission } from '@artoholic/shared';
import { getPool } from '@/db/client';
import { validateSession, type Authenticated } from '@/server/auth/sessions';
import { SESSION_COOKIE } from '@/server/auth/cookies';

/** Server-side session for pages; sends signed-out visitors to sign-in with a return path. */
export async function requirePageAuth(): Promise<Authenticated> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const here = headers().get('x-pathname') ?? '/';
  if (token) {
    try {
      return await validateSession(getPool(), token, 'web');
    } catch {
      // fall through to sign-in
    }
  }
  redirect(`/sign-in?returnTo=${encodeURIComponent(here)}`);
}

export function can(auth: Authenticated, permission: Permission): boolean {
  return hasPermission(auth.user.roles, permission);
}
