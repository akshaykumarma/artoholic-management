import { describe, it, expect } from 'vitest';
import { POST as signIn } from '../../app/api/v1/auth/sign-in/route';
import { POST as signOut } from '../../app/api/v1/auth/sign-out/route';
import { createUser } from '../helpers';
import { makeReq, setCookies } from '../request';

describe('CSRF on web state-changing requests', () => {
  it('refuses a web POST without the matching X-CSRF-Token', async () => {
    const u = await createUser({ roles: ['admin'] });
    const cookies = setCookies(await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: u.username, password: u.password } })));
    const missing = await signOut(makeReq('POST', '/api/v1/auth/sign-out', { cookies }));
    expect(missing.status).toBe(403);
    expect((await missing.json()).error.code).toBe('CSRF_FAILED');
    const wrong = await signOut(makeReq('POST', '/api/v1/auth/sign-out', { cookies, csrf: 'not-the-token' }));
    expect(wrong.status).toBe(403);
    const ok = await signOut(makeReq('POST', '/api/v1/auth/sign-out', { cookies, csrf: cookies.csrf }));
    expect(ok.status).toBe(204);
  });

  it('does not require CSRF for mobile bearer requests', async () => {
    const u = await createUser({ roles: ['admin'] });
    const { token } = await (await signIn(makeReq('POST', '/api/v1/auth/sign-in', { platform: 'ios', body: { username: u.username, password: u.password } }))).json();
    const res = await signOut(makeReq('POST', '/api/v1/auth/sign-out', { platform: 'ios', bearer: token }));
    expect(res.status).toBe(204);
  });
});
