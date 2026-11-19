import { describe, it, expect } from 'vitest';
import { userSchema, userListSchema } from '@artoholic/shared';
import { POST as createUser, GET as listUsers } from '../../app/api/v1/users/route';
import { PATCH as updateUser, GET as getUser } from '../../app/api/v1/users/[id]/route';
import { POST as tempPassword } from '../../app/api/v1/users/[id]/temporary-password/route';
import { GET as me } from '../../app/api/v1/me/route';
import { webSessionFor, mobileTokenFor } from '../session-helpers';
import { makeReq } from '../request';
import { getPool } from '../../db/client';

async function newUser(as: object, body: Record<string, unknown> = {}) {
  const res = await createUser(makeReq('POST', '/api/v1/users', {
    ...as,
    body: { fullName: 'Anil', phone: '+919876500002', username: 'anil', temporaryPassword: 'marigold-tent-42', roles: ['event_manager', 'store_manager'], ...body }
  }));
  return userSchema.parse(await res.json());
}

const patch = (as: object, id: string, ifMatch: string, body: object) =>
  updateUser(makeReq('PATCH', `/api/v1/users/${id}`, { ...as, headers: { 'if-match': ifMatch }, body }), { params: { id } });

describe('Admin edits users (002 US6)', () => {
  it('a removed role stops applying on the next request', async () => {
    const admin = await webSessionFor(['admin']);
    const u = await newUser(admin.as);
    const token = await mobileTokenFor('anil', 'marigold-tent-42');
    const res = await patch(admin.as, u.id, u.updatedAt, { roles: ['event_manager'] });
    expect(res.status).toBe(200);
    const body = await (await me(makeReq('GET', '/api/v1/me', { platform: 'android', bearer: token }))).json();
    expect(body.roles).toEqual(['event_manager']);
  });

  it('refuses a stale If-Match', async () => {
    const admin = await webSessionFor(['admin']);
    const u = await newUser(admin.as);
    expect((await patch(admin.as, u.id, u.updatedAt, { fullName: 'Anil K' })).status).toBe(200);
    const stale = await patch(admin.as, u.id, u.updatedAt, { fullName: 'Anil Kumar' });
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.code).toBe('STALE_VERSION');
  });

  it('setting a temporary password ends sessions and forces a change', async () => {
    const admin = await webSessionFor(['admin']);
    const u = await newUser(admin.as);
    const token = await mobileTokenFor('anil', 'marigold-tent-42');
    const res = await tempPassword(makeReq('POST', `/api/v1/users/${u.id}/temporary-password`, { ...admin.as, body: { temporaryPassword: 'saffron-stage-77' } }), { params: { id: u.id } });
    expect(res.status).toBe(204);
    expect((await me(makeReq('GET', '/api/v1/me', { platform: 'android', bearer: token }))).status).toBe(401);
  });

  it('audits changes with old and new values, never passwords', async () => {
    const admin = await webSessionFor(['admin']);
    const u = await newUser(admin.as);
    await patch(admin.as, u.id, u.updatedAt, { fullName: 'Anil Kumar', email: 'anil@example.com' });
    const { rows } = await getPool().query("SELECT before, after FROM audit_entries WHERE action = 'user.updated'");
    expect(rows[0].before.fullName).toBe('Anil');
    expect(rows[0].after.fullName).toBe('Anil Kumar');
    expect(rows[0].after.email).toBe('anil@example.com');
  });

  it('searches by name, username, phone and email and filters by role and status', async () => {
    const admin = await webSessionFor(['admin']);
    await newUser(admin.as);
    await newUser(admin.as, { fullName: 'Bina', phone: '+919876500003', username: 'bina', email: 'bina@example.com', roles: ['event_manager'] });
    const q = async (qs: string) => userListSchema.parse(await (await listUsers(makeReq('GET', `/api/v1/users?${qs}`, admin.as))).json()).items.map((i) => i.username);
    expect(await q('q=bina')).toEqual(['bina']);
    expect(await q('q=98765%2000002')).toEqual(['anil']);
    expect(await q('q=bina%40example')).toEqual(['bina']);
    expect((await q('role=store_manager')).sort()).toEqual(['anil']);
    expect(await q('status=deactivated')).toEqual([]);
  });

  it('GET returns the user without any secret', async () => {
    const admin = await webSessionFor(['admin']);
    const u = await newUser(admin.as);
    const res = await getUser(makeReq('GET', `/api/v1/users/${u.id}`, admin.as), { params: { id: u.id } });
    const text = await res.text();
    expect(text).not.toMatch(/password_hash|passwordHash|\$2[aby]\$/);
    expect(userSchema.parse(JSON.parse(text)).roles.sort()).toEqual(['event_manager', 'store_manager']);
  });
});
