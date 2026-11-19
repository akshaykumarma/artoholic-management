/** Builds Request objects the way each app sends them, for calling route handlers directly. */
export interface ReqOptions {
  body?: unknown;
  platform?: 'web' | 'android' | 'ios';
  version?: string;
  cookies?: Record<string, string>;
  bearer?: string;
  csrf?: string;
  ip?: string;
  headers?: Record<string, string>;
}

export function makeReq(method: string, path: string, o: ReqOptions = {}): Request {
  const headers = new Headers({
    'x-client-platform': o.platform ?? 'web',
    'x-client-version': o.version ?? '1.0.0',
    'x-forwarded-for': o.ip ?? '203.0.113.10',
    ...o.headers
  });
  if (o.body !== undefined) headers.set('content-type', 'application/json');
  if (o.cookies) headers.set('cookie', Object.entries(o.cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; '));
  if (o.bearer) headers.set('authorization', `Bearer ${o.bearer}`);
  if (o.csrf) headers.set('x-csrf-token', o.csrf);
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: o.body === undefined ? undefined : JSON.stringify(o.body)
  });
}

/** Extracts cookie name → value from Set-Cookie headers. */
export function setCookies(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(';');
    const i = pair!.indexOf('=');
    out[pair!.slice(0, i)] = decodeURIComponent(pair!.slice(i + 1));
  }
  return out;
}
