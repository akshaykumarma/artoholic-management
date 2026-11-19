export const SESSION_COOKIE = 'session';

interface CookieOpts {
  httpOnly?: boolean;
  maxAgeSeconds?: number;
}

/** Cookies are always Secure and SameSite=Lax; the session cookie is also HttpOnly. */
export function serializeCookie(name: string, value: string, o: CookieOpts = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'Secure', 'SameSite=Lax'];
  if (o.httpOnly) parts.push('HttpOnly');
  if (o.maxAgeSeconds !== undefined) parts.push(`Max-Age=${o.maxAgeSeconds}`);
  return parts.join('; ');
}

export function clearCookie(name: string, httpOnly = false): string {
  return serializeCookie(name, '', { httpOnly, maxAgeSeconds: 0 });
}
