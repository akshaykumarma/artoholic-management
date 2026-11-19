import { describe, it, expect } from 'vitest';
import { userSchema } from '@artoholic/shared';
import { POST as createUser } from '../../app/api/v1/users/route';
import { GET as me } from '../../app/api/v1/me/route';
import { webSessionFor, mobileTokenFor } from '../session-helpers';
import { makeReq } from '../request';
import { getPool } from '../../db/client';

const base = { fullName: 'Ravi Kumar', phone: '98765 43210', temporaryPassword: 'marigold-tent-42', roles: ['event_manager'] };
const post = (as: object, body: object) => createUser(makeReq('POST', '/api/v1/users', { ...as, body }));

describe('Admin creates staff accounts (002 US1)', () => {
  it('requires a phone number', async () => {
    const admin = await webSessionFor(['admin']);
    const res = await post(admin.as, { ...base, phone: '' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.details.fields.phone).toBe('Phone number is required');
  });

  it('username defaults to the email, else to the phone in international form', async () => {
    const admin = await webSessionFor(['admin']);
    const withEmail = userSchema.parse(await (await post(admin.as, { ...base, email: 'ravi@example.com' })).json());
    expect(withEmail.username).toBe('ravi@example.com');
    const noEmail = userSchema.parse(await (await post(admin.as, { ...base, phone: '+91 91234 56780' })).json());
    expect(noEmail.username).toBe('+919123456780');
    expect(noEmail.phone).toBe('+919123456780');
    expect(noEmail.mustChangePassword).toBe(true);
  });

  it('refuses identifiers already used by any account, after normalising', async () => {
    const admin = await webSessionFor(['admin']);
    expect((await post(admin.as, { ...base, email: 'ravi@example.com' })).status).toBe(201);
    const phoneClash = await post(admin.as, { ...base, phone: '09876543210', email: 'other@example.com' });
    expect(phoneClash.status).toBe(409);
    expect((await phoneClash.json()).error.details.field).toBe('phone');
    const emailClash = await post(admin.as, { ...base, phone: '+919000000001', email: 'RAVI@example.com' });
    expect((await emailClash.json()).error.details.field).toBe('email');
    const usernameLikePhone = await post(admin.as, { ...base, phone: '+919000000002', username: '+919876543210' });
    expect((await usernameLikePhone.json()).error.details.field).toBe('username');
  });

  it('refuses an invalid phone number', async () => {
    const admin = await webSessionFor(['admin']);
    const res = await post(admin.as, { ...base, phone: '12345' });
    expect(res.status).toBe(400);
  });

  it('only the Super Admin may grant the Admin role; nobody may grant Super Admin', async () => {
    const admin = await webSessionFor(['admin']);
    const asAdmin = await post(admin.as, { ...base, roles: ['admin'] });
    expect(asAdmin.status).toBe(403);
    expect((await asAdmin.json()).error.code).toBe('SUPER_ADMIN_ONLY');
    const owner = await webSessionFor(['super_admin']);
    expect((await post(owner.as, { ...base, roles: ['admin'] })).status).toBe(201);
    const sa = await post(owner.as, { ...base, phone: '+919000000003', roles: ['super_admin'] });
    expect(sa.status).toBe(403);
  });

  it('a two-role user gets the union of permissions', async () => {
    const admin = await webSessionFor(['admin']);
    await post(admin.as, { ...base, email: 'priya@example.com', roles: ['event_manager', 'store_manager'] });
    const token = await mobileTokenFor('priya@example.com', base.temporaryPassword);
    const body = await (await me(makeReq('GET', '/api/v1/me', { platform: 'android', bearer: token }))).json();
    expect(body.roles.sort()).toEqual(['event_manager', 'store_manager']);
  });

  it('refuses Event and Store Managers', async () => {
    for (const role of ['event_manager', 'store_manager'] as const) {
      const s = await webSessionFor([role]);
      expect((await post(s.as, base)).status).toBe(403);
    }
  });

  it('applies the password policy to temporary passwords', async () => {
    const admin = await webSessionFor(['admin']);
    const res = await post(admin.as, { ...base, temporaryPassword: 'password' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('PASSWORD_POLICY');
  });

  it('audits creation without the password', async () => {
    const admin = await webSessionFor(['admin']);
    await post(admin.as, base);
    const { rows } = await getPool().query("SELECT after FROM audit_entries WHERE action = 'user.created'");
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0].after)).not.toContain(base.temporaryPassword);
    expect(rows[0].after.roles).toEqual(['event_manager']);
  });
});
