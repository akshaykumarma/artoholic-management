import { describe, it, expect } from 'vitest';
import { appVersionResponseSchema, mobileVersionSettingSchema } from '@artoholic/shared';
import { GET as appVersion } from '../../app/api/v1/app-version/route';
import { PUT as putVersions } from '../../app/api/v1/admin/mobile-versions/[platform]/route';
import { POST as signIn } from '../../app/api/v1/auth/sign-in/route';
import { createUser } from '../helpers';
import { makeReq, setCookies } from '../request';
import { getPool } from '../../db/client';

async function superAdminCookies() {
  const u = await createUser({ roles: ['super_admin'] });
  return setCookies(await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: u.username, password: u.password } })));
}

describe('GET /api/v1/app-version', () => {
  it('is public and returns the platform settings', async () => {
    const res = await appVersion(makeReq('GET', '/api/v1/app-version?platform=android', { platform: 'android', version: '0.0.1' }));
    expect(res.status).toBe(200);
    const body = appVersionResponseSchema.parse(await res.json());
    expect(body).toMatchObject({ platform: 'android', minimumVersion: '0.0.0', recommendedVersion: '0.0.0' });
  });

  it('rejects an unknown platform', async () => {
    const res = await appVersion(makeReq('GET', '/api/v1/app-version?platform=windows'));
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/v1/admin/mobile-versions/{platform}', () => {
  const body = { minimumVersion: '1.2.0', recommendedVersion: '1.3.0', storeUrl: 'https://play.google.com/store/apps/details?id=in.artoholic.ops' };

  it('Super Admin saves settings and an audit entry with before/after', async () => {
    const cookies = await superAdminCookies();
    await getPool().query("INSERT INTO app_releases (platform, version, build_number, store_status) VALUES ('android', '1.2.0', 12, 'live')");
    const res = await putVersions(makeReq('PUT', '/api/v1/admin/mobile-versions/android', { cookies, csrf: cookies.csrf, body }), { params: { platform: 'android' } });
    expect(res.status).toBe(200);
    expect(mobileVersionSettingSchema.parse(await res.json())).toMatchObject(body);
    const { rows } = await getPool().query("SELECT before, after FROM audit_entries WHERE action = 'settings.mobile_version_changed'");
    expect(rows[0].before.minimumVersion).toBe('0.0.0');
    expect(rows[0].after.minimumVersion).toBe('1.2.0');
  });

  it('refuses recommended below minimum', async () => {
    const cookies = await superAdminCookies();
    const res = await putVersions(
      makeReq('PUT', '/api/v1/admin/mobile-versions/ios', { cookies, csrf: cookies.csrf, body: { ...body, recommendedVersion: '1.1.9' } }),
      { params: { platform: 'ios' } }
    );
    expect(res.status).toBe(400);
  });

  it('refuses a non-https store link and invalid semver', async () => {
    const cookies = await superAdminCookies();
    for (const bad of [{ ...body, storeUrl: 'http://example.com' }, { ...body, minimumVersion: '1.2' }]) {
      const res = await putVersions(makeReq('PUT', '/api/v1/admin/mobile-versions/ios', { cookies, csrf: cookies.csrf, body: bad }), { params: { platform: 'ios' } });
      expect(res.status).toBe(400);
    }
  });

  it('is refused for an Admin', async () => {
    const u = await createUser({ roles: ['admin'] });
    const cookies = setCookies(await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: u.username, password: u.password } })));
    const res = await putVersions(makeReq('PUT', '/api/v1/admin/mobile-versions/ios', { cookies, csrf: cookies.csrf, body }), { params: { platform: 'ios' } });
    expect(res.status).toBe(403);
  });
});
