import { describe, it, expect } from 'vitest';
import { POST as signIn } from '../../app/api/v1/auth/sign-in/route';
import { GET as me } from '../../app/api/v1/me/route';
import { GET as appVersion } from '../../app/api/v1/app-version/route';
import { PUT as putVersions } from '../../app/api/v1/admin/mobile-versions/[platform]/route';
import { createUser } from '../helpers';
import { makeReq, setCookies } from '../request';

async function raiseAndroidMinimum(min: string) {
  const u = await createUser({ roles: ['super_admin'] });
  const cookies = setCookies(await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: u.username, password: u.password } })));
  const res = await putVersions(
    makeReq('PUT', '/api/v1/admin/mobile-versions/android', {
      cookies, csrf: cookies.csrf,
      body: { minimumVersion: min, recommendedVersion: min, storeUrl: 'https://play.google.com/store/apps/details?id=in.artoholic.ops' }
    }),
    { params: { platform: 'android' } }
  );
  expect(res.status).toBe(200);
}

describe('mobile version gate (FR-031)', () => {
  it('returns 426 APP_UPDATE_REQUIRED with the store link for old Android builds', async () => {
    const u = await createUser({ roles: ['admin'] });
    const { token } = await (await signIn(makeReq('POST', '/api/v1/auth/sign-in', { platform: 'android', version: '1.0.0', body: { username: u.username, password: u.password } }))).json();
    await raiseAndroidMinimum('1.5.0');
    const res = await me(makeReq('GET', '/api/v1/me', { platform: 'android', version: '1.0.0', bearer: token }));
    expect(res.status).toBe(426);
    const body = await res.json();
    expect(body.error.code).toBe('APP_UPDATE_REQUIRED');
    expect(body.error.details).toMatchObject({ minimumVersion: '1.5.0', storeUrl: expect.stringMatching(/^https:/) });
  });

  it('allows builds at or above the minimum, other platforms and the web', async () => {
    const u = await createUser({ roles: ['admin'] });
    await raiseAndroidMinimum('1.5.0');
    const ok = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { platform: 'android', version: '1.5.0', body: { username: u.username, password: u.password } }));
    expect(ok.status).toBe(200);
    const ios = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { platform: 'ios', version: '1.0.0', body: { username: u.username, password: u.password } }));
    expect(ios.status).toBe(200);
    const web = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { platform: 'web', version: '0.0.1', body: { username: u.username, password: u.password } }));
    expect(web.status).toBe(200);
  });

  it('never gates the version-check endpoint itself', async () => {
    await raiseAndroidMinimum('9.0.0');
    const res = await appVersion(makeReq('GET', '/api/v1/app-version?platform=android', { platform: 'android', version: '1.0.0' }));
    expect(res.status).toBe(200);
  });

  it('compares versions numerically, not as text', async () => {
    const u = await createUser({ roles: ['admin'] });
    await raiseAndroidMinimum('1.9.0');
    const res = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { platform: 'android', version: '1.10.0', body: { username: u.username, password: u.password } }));
    expect(res.status).toBe(200);
  });
});
