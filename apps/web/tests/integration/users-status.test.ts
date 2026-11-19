import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { POST as createUser } from '../../app/api/v1/users/route';
import { POST as deactivate } from '../../app/api/v1/users/[id]/deactivate/route';
import { POST as reactivate } from '../../app/api/v1/users/[id]/reactivate/route';
import { PATCH as updateUser } from '../../app/api/v1/users/[id]/route';
import { GET as me } from '../../app/api/v1/me/route';
import { POST as signIn } from '../../app/api/v1/auth/sign-in/route';
import { webSessionFor, mobileTokenFor } from '../session-helpers';
import { makeReq } from '../request';
import { getPool } from '../../db/client';

async function newUser(as: object, body: Record<string, unknown> = {}) {
  const res = await createUser(makeReq('POST', '/api/v1/users', {
    ...as,
    body: { fullName: 'Suresh', phone: '+919876500001', username: 'suresh', temporaryPassword: 'marigold-tent-42', roles: ['store_manager'], ...body }
  }));
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; updatedAt: string };
}

describe('deactivate and reactivate (002 US4)', () => {
  it('ends every session of the user at once', async () => {
    const admin = await webSessionFor(['admin']);
    const u = await newUser(admin.as);
    const token = await mobileTokenFor('suresh', 'marigold-tent-42');
    const res = await deactivate(makeReq('POST', `/api/v1/users/${u.id}/deactivate`, { ...admin.as, body: { reason: 'Left the company' } }), { params: { id: u.id } });
    expect(res.status).toBe(204);
    expect((await me(makeReq('GET', '/api/v1/me', { platform: 'android', bearer: token }))).status).toBe(401);
    const again = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { identifier: 'suresh', password: 'marigold-tent-42' } }));
    expect((await again.json()).error.code).toBe('INVALID_CREDENTIALS');
    const { rows } = await getPool().query('SELECT count(*)::int AS n FROM sessions WHERE user_id = $1 AND revoked_at IS NULL', [u.id]);
    expect(rows[0].n).toBe(0);
  });

  it('keeps history: the user row and its audit entries remain', async () => {
    const admin = await webSessionFor(['admin']);
    const u = await newUser(admin.as);
    await deactivate(makeReq('POST', `/api/v1/users/${u.id}/deactivate`, { ...admin.as, body: { reason: 'Left' } }), { params: { id: u.id } });
    const { rows } = await getPool().query('SELECT full_name, status FROM users WHERE id = $1', [u.id]);
    expect(rows[0]).toEqual({ full_name: 'Suresh', status: 'deactivated' });
  });

  it('refuses self-deactivation', async () => {
    const admin = await webSessionFor(['admin']);
    await webSessionFor(['admin']); // a second Admin, so LAST_ADMIN is not the reason
    const res = await deactivate(makeReq('POST', `/api/v1/users/${admin.user.id}/deactivate`, { ...admin.as, body: { reason: 'x' } }), { params: { id: admin.user.id } });
    expect((await res.json()).error.code).toBe('SELF_DEACTIVATION');
  });

  it('refuses removing the Admin role from the last active Admin', async () => {
    const owner = await webSessionFor(['super_admin']);
    const onlyAdmin = await newUser(owner.as, { roles: ['admin'] });
    const res = await updateUser(
      makeReq('PATCH', `/api/v1/users/${onlyAdmin.id}`, { ...owner.as, headers: { 'if-match': onlyAdmin.updatedAt }, body: { roles: ['event_manager'] } }),
      { params: { id: onlyAdmin.id } }
    );
    expect((await res.json()).error.code).toBe('LAST_ADMIN');
    const deact = await deactivate(makeReq('POST', `/api/v1/users/${onlyAdmin.id}/deactivate`, { ...owner.as, body: { reason: 'x' } }), { params: { id: onlyAdmin.id } });
    expect((await deact.json()).error.code).toBe('LAST_ADMIN');
  });

  it('only the Super Admin can deactivate an Admin', async () => {
    const owner = await webSessionFor(['super_admin']);
    const admin = await webSessionFor(['admin']);
    const other = await newUser(owner.as, { roles: ['admin'] });
    const res = await deactivate(makeReq('POST', `/api/v1/users/${other.id}/deactivate`, { ...admin.as, body: { reason: 'x' } }), { params: { id: other.id } });
    expect((await res.json()).error.code).toBe('SUPER_ADMIN_ONLY');
  });

  it('reactivation needs a new temporary password and forces a change', async () => {
    const admin = await webSessionFor(['admin']);
    const u = await newUser(admin.as);
    await deactivate(makeReq('POST', `/api/v1/users/${u.id}/deactivate`, { ...admin.as, body: { reason: 'x' } }), { params: { id: u.id } });
    const res = await reactivate(makeReq('POST', `/api/v1/users/${u.id}/reactivate`, { ...admin.as, body: { temporaryPassword: 'saffron-stage-77' } }), { params: { id: u.id } });
    expect(res.status).toBe(204);
    const s = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { identifier: 'suresh', password: 'saffron-stage-77' } }));
    expect((await s.json()).user.mustChangePassword).toBe(true);
  });

  it('closes warehouse assignments history-safely when the Store Manager role is removed', async () => {
    const admin = await webSessionFor(['admin']);
    const wh = randomUUID();
    const u = await newUser(admin.as, { warehouseIds: [wh] });
    const res = await updateUser(
      makeReq('PATCH', `/api/v1/users/${u.id}`, { ...admin.as, headers: { 'if-match': u.updatedAt }, body: { roles: ['event_manager'] } }),
      { params: { id: u.id } }
    );
    expect(res.status).toBe(200);
    const { rows } = await getPool().query('SELECT unassigned_at FROM warehouse_assignments WHERE user_id = $1', [u.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].unassigned_at).not.toBeNull();
  });
});
