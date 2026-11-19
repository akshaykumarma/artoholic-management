import { describe, it, expect } from 'vitest';
import { adminStatusSchema, type Role } from '@artoholic/shared';
import { GET as health } from '../../app/api/health/route';
import { GET as status } from '../../app/api/v1/admin/status/route';
import { POST as signIn } from '../../app/api/v1/auth/sign-in/route';
import { createUser } from '../helpers';
import { makeReq, setCookies } from '../request';
import { getPool } from '../../db/client';
import { resetHealthMemo } from '../../server/health/checks';

async function cookiesFor(roles: Role[]) {
  const u = await createUser({ roles });
  return setCookies(await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { username: u.username, password: u.password } })));
}

describe('GET /api/health (public)', () => {
  it('answers only an overall status', async () => {
    resetHealthMemo();
    const res = await health(new Request('http://localhost/api/health'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'up' });
  });
});

describe('GET /api/v1/admin/status', () => {
  it('Super Admin sees parts, overall, version and mobile settings', async () => {
    resetHealthMemo();
    await getPool().query("INSERT INTO system_heartbeats (name, last_beat_at) VALUES ('jobs', now())");
    const cookies = await cookiesFor(['super_admin']);
    const res = await status(makeReq('GET', '/api/v1/admin/status', { cookies }));
    expect(res.status).toBe(200);
    const body = adminStatusSchema.parse(await res.json());
    expect(body.parts.map((p) => p.part)).toEqual(['database', 'fileStorage', 'backgroundWork']);
    expect(body.parts.find((p) => p.part === 'database')!.status).toBe('ok');
    expect(body.mobileVersions.map((m) => m.platform).sort()).toEqual(['android', 'ios']);
  });

  it('is refused for other roles', async () => {
    const cookies = await cookiesFor(['admin']);
    const res = await status(makeReq('GET', '/api/v1/admin/status', { cookies }));
    expect(res.status).toBe(403);
  });
});
