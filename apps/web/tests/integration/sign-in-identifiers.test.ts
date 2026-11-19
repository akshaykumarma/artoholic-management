import { describe, it, expect } from 'vitest';
import { POST as createUser } from '../../app/api/v1/users/route';
import { POST as signIn } from '../../app/api/v1/auth/sign-in/route';
import { POST as changePassword } from '../../app/api/v1/auth/change-password/route';
import { GET as me } from '../../app/api/v1/me/route';
import { GET as listUsers } from '../../app/api/v1/users/route';
import { webSessionFor } from '../session-helpers';
import { makeReq } from '../request';

async function makePriya() {
  const admin = await webSessionFor(['admin']);
  const res = await createUser(makeReq('POST', '/api/v1/users', {
    ...admin.as,
    body: { fullName: 'Priya', phone: '+919876543210', email: 'priya@example.com', username: 'priya', temporaryPassword: 'marigold-tent-42', roles: ['admin'] }
  }));
  expect(res.status).toBe(403); // Admin cannot create Admins
  const owner = await webSessionFor(['super_admin']);
  const ok = await createUser(makeReq('POST', '/api/v1/users', {
    ...owner.as,
    body: { fullName: 'Priya', phone: '+919876543210', email: 'priya@example.com', username: 'priya', temporaryPassword: 'marigold-tent-42', roles: ['admin'] }
  }));
  expect(ok.status).toBe(201);
}

const mobileSignIn = (identifier: string, password = 'marigold-tent-42') =>
  signIn(makeReq('POST', '/api/v1/auth/sign-in', { platform: 'android', body: { identifier, password } }));

describe('sign in with username, email or phone (002 US2)', () => {
  it.each(['priya', 'PRIYA@example.com', '+919876543210', '98765 43210', '09876543210'])('accepts %s', async (identifier) => {
    await makePriya();
    expect((await mobileSignIn(identifier)).status).toBe(200);
  });

  it('a temporary password forces a change before anything else', async () => {
    await makePriya();
    const { token, user } = await (await mobileSignIn('priya')).json();
    expect(user.mustChangePassword).toBe(true);
    const blocked = await listUsers(makeReq('GET', '/api/v1/users', { platform: 'android', bearer: token }));
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    expect((await me(makeReq('GET', '/api/v1/me', { platform: 'android', bearer: token }))).status).toBe(200);

    const weak = await changePassword(makeReq('POST', '/api/v1/auth/change-password', { platform: 'android', bearer: token, body: { currentPassword: 'marigold-tent-42', newPassword: 'priya' } }));
    expect(weak.status).toBe(400);
    const ok = await changePassword(makeReq('POST', '/api/v1/auth/change-password', { platform: 'android', bearer: token, body: { currentPassword: 'marigold-tent-42', newPassword: 'saffron-stage-77' } }));
    expect(ok.status).toBe(204);
    const now = await listUsers(makeReq('GET', '/api/v1/users', { platform: 'android', bearer: token }));
    expect(now.status).toBe(200);
  });

  it('changing the password ends the other sessions', async () => {
    await makePriya();
    const a = (await (await mobileSignIn('priya')).json()).token;
    const b = (await (await mobileSignIn('priya')).json()).token;
    await changePassword(makeReq('POST', '/api/v1/auth/change-password', { platform: 'android', bearer: a, body: { currentPassword: 'marigold-tent-42', newPassword: 'saffron-stage-77' } }));
    expect((await me(makeReq('GET', '/api/v1/me', { platform: 'android', bearer: a }))).status).toBe(200);
    expect((await me(makeReq('GET', '/api/v1/me', { platform: 'android', bearer: b }))).status).toBe(401);
  });

  it('a wrong current password is refused', async () => {
    await makePriya();
    const { token } = await (await mobileSignIn('priya')).json();
    const res = await changePassword(makeReq('POST', '/api/v1/auth/change-password', { platform: 'android', bearer: token, body: { currentPassword: 'nope-nope-nope', newPassword: 'saffron-stage-77' } }));
    expect(res.status).toBe(401);
  });
});
