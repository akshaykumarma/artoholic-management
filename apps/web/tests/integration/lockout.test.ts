import { describe, it, expect, vi, afterEach } from 'vitest';
import { POST as signIn } from '../../app/api/v1/auth/sign-in/route';
import { createUser } from '../helpers';
import { makeReq } from '../request';

const attempt = (username: string, password: string, ip = '198.51.100.7') =>
  signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username, password }, ip }));

afterEach(() => vi.useRealTimers());

describe('sign-in lockout (FR-006)', () => {
  it('locks an account after 5 failures within 15 minutes, even with the right password', async () => {
    const u = await createUser();
    for (let i = 0; i < 4; i++) expect((await attempt(u.username, 'wrong-password')).status).toBe(401);
    const fifth = await attempt(u.username, 'wrong-password');
    expect(fifth.status).toBe(429);
    const body = await fifth.json();
    expect(body.error.code).toBe('SIGN_IN_LOCKED');
    expect(new Date(body.error.details.retryAt).getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect((await attempt(u.username, u.password)).status).toBe(429);
  });

  it('unlocks 15 minutes after the 5th failure', async () => {
    const u = await createUser();
    for (let i = 0; i < 5; i++) await attempt(u.username, 'wrong-password');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 15 * 60_000 + 1_000);
    expect((await attempt(u.username, u.password)).status).toBe(200);
  });

  it('throttles unknown usernames per network address', async () => {
    for (let i = 0; i < 4; i++) expect((await attempt(`ghost${i}`, 'whatever-pass', '192.0.2.50')).status).toBe(401);
    expect((await attempt('ghost-last', 'whatever-pass', '192.0.2.50')).status).toBe(429);
    expect((await attempt('ghost-other', 'whatever-pass', '192.0.2.51')).status).toBe(401);
  });

  it('does not lock other accounts', async () => {
    const a = await createUser();
    const b = await createUser();
    for (let i = 0; i < 5; i++) await attempt(a.username, 'wrong-password');
    expect((await attempt(b.username, b.password)).status).toBe(200);
  });
});
