import { randomBytes, timingSafeEqual } from 'node:crypto';

export const CSRF_COOKIE = 'csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function newCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Double-submit check: header must equal the csrf cookie (research R2). */
export function csrfValid(cookie: string | undefined, header: string | null): boolean {
  if (!cookie || !header) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}
