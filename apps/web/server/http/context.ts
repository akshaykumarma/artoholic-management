import type { ClientPlatform } from '@artoholic/shared';

export interface RequestContext {
  platform: ClientPlatform;
  version: string;
  ip: string | null;
  cookies: Record<string, string>;
  bearer: string | null;
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const PLATFORMS: readonly ClientPlatform[] = ['web', 'android', 'ios'];

export function getRequestContext(req: Request): RequestContext {
  const h = req.headers;
  const p = (h.get('x-client-platform') ?? 'web').toLowerCase() as ClientPlatform;
  const auth = h.get('authorization');
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    platform: PLATFORMS.includes(p) ? p : 'web',
    version: h.get('x-client-version') ?? '0.0.0',
    ip: forwarded || h.get('x-real-ip') || null,
    cookies: parseCookies(h.get('cookie')),
    bearer: auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
  };
}
