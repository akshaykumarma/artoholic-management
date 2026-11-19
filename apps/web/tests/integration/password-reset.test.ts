import { describe, it, expect, vi, afterEach } from 'vitest';
import { POST as createUser } from '../../app/api/v1/users/route';
import { POST as forgot } from '../../app/api/v1/auth/forgot/route';
import { POST as reset } from '../../app/api/v1/auth/reset/route';
import { POST as signIn } from '../../app/api/v1/auth/sign-in/route';
import { GET as me } from '../../app/api/v1/me/route';
import { webSessionFor } from '../session-helpers';
import { makeReq } from '../request';
import { getPool } from '../../db/client';

afterEach(() => vi.useRealTimers());

async function setup(email: string | null = 'ravi@example.com') {
  const admin = await webSessionFor(['admin']);
  const res = await createUser(makeReq('POST', '/api/v1/users', {
    ...admin.as,
    body: { fullName: 'Ravi', phone: '+919876543210', ...(email ? { email } : {}), username: 'ravi', temporaryPassword: 'marigold-tent-42', roles: ['event_manager'] }
  }));
  expect(res.status).toBe(201);
}

const ask = (identifier: string, ip = '203.0.113.20') => forgot(makeReq('POST', '/api/v1/auth/forgot', { body: { identifier }, ip }));
const latestCode = async (to: string) => {
  const { rows } = await getPool().query('SELECT body FROM dev_outbox WHERE to_address = $1 ORDER BY id DESC LIMIT 1', [to]);
  return /(\d{6})/.exec(rows[0]?.body ?? '')?.[1];
};
const doReset = (code: string, newPassword = 'saffron-stage-77') =>
  reset(makeReq('POST', '/api/v1/auth/reset', { body: { identifier: 'ravi', code, newPassword } }));

describe('forgotten password reset (002 US3)', () => {
  it('always answers the same, whether or not the account exists', async () => {
    await setup();
    const known = await ask('ravi');
    const unknown = await ask('nobody-here');
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(await known.json()).toEqual(await unknown.json());
  });

  it('sends the same code by WhatsApp and email, stores only its HMAC, and redacts it in the audit log', async () => {
    await setup();
    await ask('ravi');
    const wa = await latestCode('+919876543210');
    const mail = await latestCode('ravi@example.com');
    expect(wa).toMatch(/^\d{6}$/);
    expect(mail).toBe(wa);
    const { rows } = await getPool().query("SELECT encode(code_hmac, 'hex') AS h FROM password_resets");
    expect(rows[0].h).not.toContain(wa);
    const audit = await getPool().query('SELECT after FROM audit_entries');
    expect(JSON.stringify(audit.rows)).not.toContain(wa!);
  });

  it('sends by WhatsApp only when there is no email', async () => {
    await setup(null);
    await ask('+919876543210');
    const { rows } = await getPool().query('SELECT channel FROM dev_outbox');
    expect(rows.map((r) => r.channel)).toEqual(['whatsapp']);
  });

  it('a correct code sets the new password and ends every session', async () => {
    await setup();
    const token = (await (await signIn(makeReq('POST', '/api/v1/auth/sign-in', { platform: 'android', body: { identifier: 'ravi', password: 'marigold-tent-42' } }))).json()).token;
    await ask('ravi');
    expect((await doReset((await latestCode('+919876543210'))!)).status).toBe(204);
    expect((await me(makeReq('GET', '/api/v1/me', { platform: 'android', bearer: token }))).status).toBe(401);
    const res = await signIn(makeReq('POST', '/api/v1/auth/sign-in', { body: { identifier: 'ravi', password: 'saffron-stage-77' } }));
    expect(res.status).toBe(200);
    expect((await res.json()).user.mustChangePassword).toBe(false);
  });

  it('refuses after 5 wrong codes, even the right one', async () => {
    await setup();
    await ask('ravi');
    const code = (await latestCode('+919876543210'))!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await doReset(wrong)).status).toBe(400);
    const res = await doReset(code);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('RESET_CODE_INVALID');
  });

  it('expires codes after 10 minutes', async () => {
    await setup();
    await ask('ravi');
    const code = (await latestCode('+919876543210'))!;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 10 * 60_000 + 1_000);
    expect((await doReset(code)).status).toBe(400);
  });

  it('sends at most 3 codes per account per hour, still answering generically', async () => {
    await setup();
    for (let i = 0; i < 5; i++) expect((await ask('ravi', `203.0.113.${30 + i}`)).status).toBe(202);
    const { rows } = await getPool().query("SELECT count(*)::int AS n FROM dev_outbox WHERE channel = 'whatsapp'");
    expect(rows[0].n).toBe(3);
  });
});
