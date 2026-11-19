import { describe, it, expect, vi, afterEach } from 'vitest';
import { POST as signIn } from '../../app/api/v1/auth/sign-in/route';
import { GET as me } from '../../app/api/v1/me/route';
import { createUser } from '../helpers';
import { makeReq, setCookies } from '../request';
import { getPool } from '../../db/client';

afterEach(() => vi.useRealTimers());

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function travel(ms: number) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + ms);
}

async function webSession() {
  const u = await createUser({ roles: ['admin'] });
  const res = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: u.username, password: u.password } }));
  return { u, cookies: setCookies(res) };
}

async function mobileSession() {
  const u = await createUser({ roles: ['admin'] });
  const res = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { platform: 'android', body: { username: u.username, password: u.password } }));
  return { u, token: (await res.json()).token as string };
}

describe('web sessions: 60-minute sliding idle timeout (FR-005a)', () => {
  it('stays valid while used, then expires after 60 idle minutes', async () => {
    const { cookies } = await webSession();
    const call = () => me(makeReq('GET', '/api/v1/me', { cookies }));
    travel(50 * MIN);
    expect((await call()).status).toBe(200); // slides the window
    vi.setSystemTime(Date.now() + 50 * MIN);
    expect((await call()).status).toBe(200);
    vi.setSystemTime(Date.now() + 61 * MIN);
    const res = await call();
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('SESSION_EXPIRED');
  });
});

describe('mobile sessions: fixed 30-day expiry', () => {
  it('is valid at 29 days and expired after 30, however active', async () => {
    const { token } = await mobileSession();
    const call = () => me(makeReq('GET', '/api/v1/me', { platform: 'android', bearer: token }));
    travel(29 * DAY);
    expect((await call()).status).toBe(200);
    vi.setSystemTime(Date.now() + 1 * DAY + MIN);
    expect((await (await call()).json()).error.code).toBe('SESSION_EXPIRED');
  });
});

describe('session validity is re-checked on every request', () => {
  it('refuses a deactivated user immediately', async () => {
    const { u, token } = await mobileSession();
    await getPool().query("UPDATE users SET status = 'deactivated' WHERE id = $1", [u.id]);
    const res = await me(makeReq('GET', '/api/v1/me', { platform: 'android', bearer: token }));
    expect(res.status).toBe(401);
  });

  it('reflects role changes on the next request', async () => {
    const { u, cookies } = await webSession();
    await getPool().query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'super_admin')", [u.id]);
    const body = await (await me(makeReq('GET', '/api/v1/me', { cookies }))).json();
    expect(body.roles).toContain('super_admin');
    expect(body.menu.map((m: { moduleId: string }) => m.moduleId)).toContain('admin-status');
  });

  it('a web token cannot be used as a mobile bearer and vice versa', async () => {
    const { cookies } = await webSession();
    const res = await me(makeReq('GET', '/api/v1/me', { platform: 'android', bearer: cookies.session }));
    expect(res.status).toBe(401);
  });

  it('stores only a hash of the token', async () => {
    const { token } = await mobileSession();
    const { rows } = await getPool().query("SELECT encode(token_hash, 'hex') AS h FROM sessions");
    expect(rows[0].h).not.toContain(Buffer.from(token).toString('hex'));
    expect(rows[0].h).toHaveLength(64);
  });
});
