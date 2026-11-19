/** Minimal fetch mock: queue responses per path prefix. */
type Reply = { status: number; body?: unknown };
const routes: Array<{ match: string; reply: Reply | (() => Reply) }> = [];
export const calls: Array<{ url: string; init?: RequestInit }> = [];

export function onRequest(match: string, reply: Reply | (() => Reply)) {
  routes.push({ match, reply });
}

export function resetFetch() {
  routes.length = 0;
  calls.length = 0;
}

export function installFetch() {
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    const route = [...routes].reverse().find((r) => u.includes(r.match));
    if (!route) throw new TypeError('Network request failed');
    const r = typeof route.reply === 'function' ? route.reply() : route.reply;
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' }
    });
  }) as unknown as typeof fetch;
}

export const ME = {
  id: '6f1c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f',
  fullName: 'Owner',
  username: 'owner',
  roles: ['super_admin'],
  menu: [
    { moduleId: 'home', labelKey: 'module.home', path: '/' },
    { moduleId: 'conventions', labelKey: 'module.conventions', path: '/reference/conventions' }
  ],
  mustChangePassword: false,
  session: { expiresAt: '2026-12-19T10:00:00.000Z', idleTimeoutMinutes: null }
};
