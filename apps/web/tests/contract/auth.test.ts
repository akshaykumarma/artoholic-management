import { describe, it, expect } from 'vitest';
import type { Role } from '@artoholic/shared';
import { meResponseSchema, signInWebResponseSchema, signInMobileResponseSchema, errorBodySchema } from '@artoholic/shared';
import { POST as signIn } from '../../app/api/v1/auth/sign-in/route';
import { POST as signOut } from '../../app/api/v1/auth/sign-out/route';
import { GET as me } from '../../app/api/v1/me/route';
import { createUser } from '../helpers';
import { makeReq, setCookies } from '../request';
import { getPool } from '../../db/client';

describe('POST /api/v1/auth/sign-in', () => {
  it('web: sets HttpOnly Secure session cookie and csrf cookie, returns Me', async () => {
    const u = await createUser({ roles: ['super_admin'] });
    const res = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: u.username, password: u.password } }));
    expect(res.status).toBe(200);
    const body = signInWebResponseSchema.parse(await res.json());
    expect(body.user.roles).toEqual(['super_admin']);
    const raw = res.headers.getSetCookie().join('\n');
    expect(raw).toMatch(/session=[^;]+;.*HttpOnly/i);
    expect(raw).toMatch(/session=[^;]+;.*Secure/i);
    expect(setCookies(res).csrf).toBeTruthy();
  });

  it('mobile: returns a bearer token and expiry, no cookies', async () => {
    const u = await createUser({ roles: ['super_admin'] });
    const res = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { platform: 'android', body: { username: u.username, password: u.password } }));
    expect(res.status).toBe(200);
    const body = signInMobileResponseSchema.parse(await res.json());
    expect(body.token.length).toBeGreaterThan(30);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it('gives one generic error for wrong password and unknown username', async () => {
    const u = await createUser();
    const wrong = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: u.username, password: 'nope-nope-nope' } }));
    const unknown = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: 'nobody', password: 'nope-nope-nope' } }));
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    const a = errorBodySchema.parse(await wrong.json());
    const b = errorBodySchema.parse(await unknown.json());
    expect(a).toEqual(b);
    expect(a.error.code).toBe('INVALID_CREDENTIALS');
    expect(a.error.message).toBe('Username or password is incorrect');
  });

  it('refuses deactivated users with the same generic error', async () => {
    const u = await createUser({ status: 'deactivated' });
    const res = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: u.username, password: u.password } }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects a malformed body with VALIDATION_FAILED', async () => {
    const res = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: '' } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('audits sign-in and failed sign-in without secrets', async () => {
    const u = await createUser();
    await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: u.username, password: 'bad-password-1' } }));
    await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: u.username, password: u.password } }));
    const { rows } = await getPool().query('SELECT action, actor_user_id, client_platform, network_address::text AS ip, after FROM audit_entries ORDER BY id');
    expect(rows.map((r) => r.action)).toEqual(['auth.sign_in_failed', 'auth.sign_in']);
    expect(rows[1].actor_user_id).toBe(u.id);
    expect(rows[1].client_platform).toBe('web');
    expect(rows[1].ip).toBe('203.0.113.10/32');
    expect(JSON.stringify(rows)).not.toContain(u.password);
  });
});

describe('GET /api/v1/me and sign-out', () => {
  async function signedInWeb(roles: Role[] = ['super_admin']) {
    const u = await createUser({ roles });
    const res = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: u.username, password: u.password } }));
    return { u, cookies: setCookies(res) };
  }

  it('returns the user, roles, menu and session info', async () => {
    const { cookies } = await signedInWeb();
    const res = await me(makeReq('GET', '/api/v1/me', { cookies }));
    expect(res.status).toBe(200);
    const body = meResponseSchema.parse(await res.json());
    expect(body.menu.map((m) => m.moduleId)).toEqual(['home', 'users', 'inventory', 'warehouses', 'events', 'checklists', 'counts', 'notifications', 'reports', 'admin-status', 'conventions']);
    expect(body.session.idleTimeoutMinutes).toBe(60);
  });

  it('menu omits web-only modules on mobile', async () => {
    const u = await createUser({ roles: ['super_admin'] });
    const res = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { platform: 'ios', body: { username: u.username, password: u.password } }));
    const { token } = await res.json();
    const body = meResponseSchema.parse(await (await me(makeReq('GET', '/api/v1/me', { platform: 'ios', bearer: token }))).json());
    expect(body.menu.map((m) => m.moduleId)).toEqual(['home', 'users', 'inventory', 'warehouses', 'events', 'checklists', 'counts', 'notifications', 'reports', 'conventions']);
    expect(body.session.idleTimeoutMinutes).toBeNull();
  });

  it('401 NOT_SIGNED_IN without a session', async () => {
    const res = await me(makeReq('GET', '/api/v1/me'));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('NOT_SIGNED_IN');
  });

  it('sign-out revokes the session and clears cookies', async () => {
    const { cookies } = await signedInWeb();
    const out = await signOut(makeReq('POST', '/api/v1/auth/sign-out', { cookies, csrf: cookies.csrf }));
    expect(out.status).toBe(204);
    expect(out.headers.getSetCookie().join('\n')).toMatch(/session=;.*Max-Age=0/i);
    const after = await me(makeReq('GET', '/api/v1/me', { cookies }));
    expect((await after.json()).error.code).toBe('SESSION_EXPIRED');
    const { rows } = await getPool().query("SELECT count(*)::int AS n FROM audit_entries WHERE action = 'auth.sign_out'");
    expect(rows[0].n).toBe(1);
  });
});
