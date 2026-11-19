import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { notificationListSchema, preferencesSchema } from '@artoholic/shared';
import { GET as listN } from '../../app/api/v1/notifications/route';
import { GET as unread } from '../../app/api/v1/notifications/unread-count/route';
import { POST as readOne } from '../../app/api/v1/notifications/[id]/read/route';
import { POST as readAll } from '../../app/api/v1/notifications/read-all/route';
import { GET as getPrefs, PUT as putPrefs } from '../../app/api/v1/me/notification-preferences/route';
import { POST as registerPush } from '../../app/api/v1/me/push-registrations/route';
import { GET as getProvider, PUT as putProvider } from '../../app/api/v1/admin/providers/[channel]/route';
import { POST as testSend } from '../../app/api/v1/admin/providers/[channel]/test/route';
import { PUT as putTemplates } from '../../app/api/v1/admin/template-mappings/route';
import { GET as adminMessages } from '../../app/api/v1/admin/messages/route';
import { POST as webhook } from '../../app/api/webhooks/whatsapp/route';
import { POST as signOut } from '../../app/api/v1/auth/sign-out/route';
import { POST as forgot } from '../../app/api/v1/auth/forgot/route';
import { webSessionFor, mobileTokenFor, type WebSession } from '../session-helpers';
import { createUser } from '../helpers';
import { processOutbox, quietUntil } from '../../server/notifications/dispatcher';
import { processJobs } from '../../server/notifications/sender';
import * as clock from '../../server/auth/clock';
import { getPool } from '../../db/client';
import { makeReq } from '../request';

afterEach(() => vi.restoreAllMocks());
type As = WebSession['as'];
let phone = 9800000000;
async function person(roles: Parameters<typeof webSessionFor>[0]) {
  const s = await webSessionFor(roles);
  phone += 1;
  await getPool().query('UPDATE users SET phone_e164 = $2, email = $3 WHERE id = $1', [s.user.id, `+91${phone}`, `${s.user.username}@example.com`]);
  return s;
}
const fire = async (trigger: string, payload: Record<string, unknown>, actor: string | null = null, recordId = 'rec-1') => {
  await getPool().query('INSERT INTO notification_outbox (trigger, record_type, record_id, payload, actor_user_id) VALUES ($1, $2, $3, $4, $5)', [trigger, 'event', recordId, JSON.stringify(payload), actor]);
  await processOutbox();
};
const jobs = async () => (await getPool().query<{ channel: string; user_id: string; send_after: Date }>("SELECT channel, user_id, send_after FROM channel_jobs ORDER BY created_at")).rows;
const msgs = async () => (await getPool().query<{ channel: string; user_id: string; status: string; rendered_text: string; id: string; to_address: string }>('SELECT * FROM messages ORDER BY queued_at')).rows;
async function mapWhatsApp(sa: As, trigger: string) {
  await putTemplates(makeReq('PUT', '/x', { ...sa, body: { items: [{ trigger, channel: 'whatsapp', templateName: 'event_assigned', language: 'en', variables: ['number', 'name'], bodyText: 'You are assigned to {{1}} ({{2}}).' }] } }));
}

describe('dispatch (008 US1)', () => {
  it('one notification per recipient per channel; the actor gets in-app only; no template → WhatsApp skipped', async () => {
    const sa = await person(['super_admin']);
    const em = await person(['event_manager']);
    const sm = await person(['store_manager', 'event_manager']);
    await mapWhatsApp(sa.as, 'event.scheduled');
    await fire('event.scheduled', { eventId: 'e1', number: 'EVT-2026-0001', name: 'Sangeet', link: '/events/e1', recipientIds: [em.user.id, sm.user.id, sm.user.id, sa.user.id] }, sa.user.id);
    const n = (await getPool().query('SELECT user_id, title, path FROM notifications')).rows;
    expect(n).toHaveLength(3);
    expect(n[0]).toMatchObject({ title: 'New event EVT-2026-0001: Sangeet', path: '/events/e1' });
    const j = await jobs();
    expect(j.filter((x) => x.user_id === sa.user.id)).toHaveLength(0);
    expect(j.filter((x) => x.channel === 'push').map((x) => x.user_id).sort()).toEqual([em.user.id, sm.user.id].sort());
    const m = await msgs();
    expect(m.map((x) => x.channel)).toEqual(['whatsapp', 'whatsapp']);
    expect(m[0]!.rendered_text).toBe('You are assigned to EVT-2026-0001 (Sangeet).');

    await fire('event.round_added', { eventId: 'e1', number: 'EVT-2026-0001', round: 2, recipientIds: [em.user.id] }, null, 'rec-2');
    const skipped = (await msgs()).find((x) => x.status === 'skipped')!;
    const ev = (await getPool().query('SELECT detail FROM message_events WHERE message_id = $1', [skipped.id])).rows;
    expect(ev[0].detail).toBe('no template');
    expect((await jobs()).filter((x) => x.channel === 'push')).toHaveLength(3);
  });

  it('merges a repeat within 60 seconds and delivers push and WhatsApp through the providers', async () => {
    const sa = await person(['super_admin']);
    const em = await person(['event_manager']);
    await mapWhatsApp(sa.as, 'event.scheduled');
    const token = await mobileTokenFor(em.user.username, em.user.password);
    expect((await registerPush(makeReq('POST', '/x', { platform: 'android', bearer: token, body: { expoToken: 'ExponentPushToken[abc123xyz]' } }))).status).toBe(201);
    await fire('event.scheduled', { eventId: 'e1', number: 'EVT-2026-0001', name: 'Sangeet', recipientIds: [em.user.id] });
    await fire('event.scheduled', { eventId: 'e1', number: 'EVT-2026-0001', name: 'Sangeet (updated)', recipientIds: [em.user.id] });
    expect((await getPool().query('SELECT title FROM notifications')).rows).toEqual([{ title: 'New event EVT-2026-0001: Sangeet (updated)' }]);
    expect(await processJobs()).toBe(2);
    const out = (await getPool().query('SELECT channel, to_address FROM dev_outbox ORDER BY id')).rows;
    expect(out).toEqual(expect.arrayContaining([{ channel: 'push', to_address: 'ExponentPushToken[abc123xyz]' }, { channel: 'whatsapp', to_address: expect.stringMatching(/^\+91/) }]));
    expect((await msgs())[0]!.status).toBe('sent');
  });

  it('a signed-out device stops receiving push', async () => {
    const em = await person(['event_manager']);
    const token = await mobileTokenFor(em.user.username, em.user.password);
    await registerPush(makeReq('POST', '/x', { platform: 'android', bearer: token, body: { expoToken: 'ExponentPushToken[gone]' } }));
    await signOut(makeReq('POST', '/x', { platform: 'android', bearer: token }));
    await fire('event.changed', { eventId: 'e1', number: 'EVT-2026-0001', name: 'x', recipientIds: [em.user.id] });
    await processJobs();
    expect((await getPool().query("SELECT 1 FROM dev_outbox WHERE channel = 'push'")).rowCount).toBe(0);
  });
});

describe('preferences and quiet hours (008 US3)', () => {
  it('a channel turned off is skipped; quiet hours hold push and WhatsApp except damage alerts to Admins', async () => {
    const sa = await person(['super_admin']);
    const sm = await person(['store_manager']);
    const admin = await person(['admin']);
    await mapWhatsApp(sa.as, 'count.due');
    const prefs = preferencesSchema.parse(await (await getPrefs(makeReq('GET', '/x', sm.as))).json());
    expect(prefs.groups.counts).toMatchObject({ push: true, whatsapp: true });
    prefs.groups.counts!.whatsapp = false;
    prefs.quietHours = { enabled: true, start: '22:00', end: '07:00' };
    expect((await putPrefs(makeReq('PUT', '/x', { ...sm.as, body: prefs }))).status).toBe(200);
    await getPool().query("INSERT INTO quiet_hours (user_id, start_minute_ist, end_minute_ist) VALUES ($1, 1320, 420)", [admin.user.id]);
    const night = new Date('2026-12-01T17:30:00Z'); // 23:00 IST
    vi.spyOn(clock, 'now').mockReturnValue(night);
    await fire('count.due', { number: 'CNT-2026-0001', dueDate: '2026-12-02', link: '/counts/c1', recipientIds: [sm.user.id] }, null, 'c1');
    await fire('damage.reported', { reportId: 'd1', number: 'DMG-2026-00001', kind: 'Damaged', quantity: '2', item: 'Chair', eventNumber: 'EVT-1', recipientIds: [admin.user.id] }, null, 'd1');
    const j = await jobs();
    expect(j.filter((x) => x.user_id === sm.user.id).map((x) => x.channel)).toEqual(['push']);
    expect(j.find((x) => x.user_id === sm.user.id)!.send_after.toISOString()).toBe('2026-12-02T01:30:00.000Z'); // 07:00 IST
    expect(j.find((x) => x.user_id === admin.user.id && x.channel === 'push')!.send_after.toISOString()).toBe(night.toISOString());
  });

  it('quiet windows work across midnight and inside one day', () => {
    expect(quietUntil(new Date('2026-12-01T20:00:00Z'), { start: 1320, end: 420 })?.toISOString()).toBe('2026-12-02T01:30:00.000Z');
    expect(quietUntil(new Date('2026-12-01T06:00:00Z'), { start: 1320, end: 420 })).toBeNull();
    expect(quietUntil(new Date('2026-12-01T08:00:00Z'), { start: 780, end: 840 })?.toISOString()).toBe('2026-12-01T08:30:00.000Z');
  });
});

describe('notification centre (008 US2)', () => {
  it('lists newest first with an unread count; read one or all; older than 90 days disappear', async () => {
    const em = await person(['event_manager']);
    for (const r of ['a', 'b', 'c']) await fire('event.changed', { eventId: r, number: `EVT-${r}`, name: r, recipientIds: [em.user.id] }, null, r);
    await getPool().query("INSERT INTO notifications (user_id, trigger, title, body, created_at, dedupe_key) VALUES ($1, 'event.changed', 'old', '', now() - interval '91 days', 'old')", [em.user.id]);
    const list = notificationListSchema.parse(await (await listN(makeReq('GET', '/x', em.as))).json());
    expect(list.items.map((i) => i.title)).toHaveLength(3);
    expect(list.unread).toBe(3);
    const r = await (await readOne(makeReq('POST', '/x', { ...em.as, body: {} }), { params: { id: list.items[0]!.id } })).json();
    expect(r.unread).toBe(2);
    expect((await (await unread(makeReq('GET', '/x', em.as))).json()).unread).toBe(2);
    await readAll(makeReq('POST', '/x', { ...em.as, body: {} }));
    expect((await (await unread(makeReq('GET', '/x', em.as))).json()).unread).toBe(0);
  });
});

describe('message log (008 US5)', () => {
  it('logs the reset code redacted while the phone receives it', async () => {
    const u = await createUser({ roles: ['event_manager'] });
    await getPool().query("UPDATE users SET phone_e164 = '+919811111111' WHERE id = $1", [u.id]);
    await forgot(makeReq('POST', '/x', { body: { identifier: u.username } }));
    const m = (await msgs())[0]!;
    expect(m.rendered_text).toContain('••••••');
    expect(m.rendered_text).not.toMatch(/\d{6}/);
    expect((await getPool().query('SELECT body FROM dev_outbox')).rows[0].body).toMatch(/\d{6}/);
  });

  it('retries a failing provider 3 times over ~15 minutes, then fails and tells the Super Admin', async () => {
    const sa = await person(['super_admin']);
    const em = await person(['event_manager']);
    await mapWhatsApp(sa.as, 'event.scheduled');
    await putProvider(makeReq('PUT', '/x', { ...sa.as, body: { config: { provider: 'cloud', phoneNumberId: '123' }, secret: JSON.stringify({ accessToken: 'tok', appSecret: 'shh' }) } }), { params: { channel: 'whatsapp' } });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('provider unreachable'));
    await fire('event.scheduled', { eventId: 'e1', number: 'EVT-1', name: 'x', recipientIds: [em.user.id] });
    let t = Date.now();
    for (let i = 0; i < 4; i++) {
      vi.spyOn(clock, 'now').mockReturnValue(new Date(t));
      await processJobs();
      t += 10 * 60_000;
    }
    const m = (await msgs())[0]!;
    expect(m.status).toBe('failed');
    const ev = (await getPool().query('SELECT status FROM message_events WHERE message_id = $1 ORDER BY id', [m.id])).rows.map((r) => r.status);
    expect(ev).toEqual(['queued', 'retrying', 'retrying', 'retrying', 'failed']);
    const alert = (await getPool().query("SELECT payload FROM notification_outbox WHERE trigger = 'message.failed'")).rows[0].payload;
    expect(alert.recipientIds).toEqual([sa.user.id]);
  });

  it('webhook statuses update the log only with a valid signature', async () => {
    const sa = await person(['super_admin']);
    await putProvider(makeReq('PUT', '/x', { ...sa.as, body: { config: { provider: 'mock', verifyToken: 'vt' }, secret: JSON.stringify({ appSecret: 'shh' }) } }), { params: { channel: 'whatsapp' } });
    const { rows } = await getPool().query("INSERT INTO messages (channel, to_address, trigger, rendered_text, provider_message_id, status) VALUES ('whatsapp', '+919800000001', 'event.scheduled', 'hi', 'wamid.1', 'sent') RETURNING id");
    const body = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered' }] } }] }] });
    const sig = `sha256=${createHmac('sha256', 'shh').update(body).digest('hex')}`;
    expect((await webhook(new Request('http://x/api/webhooks/whatsapp', { method: 'POST', body, headers: { 'x-hub-signature-256': 'sha256=bad' } }))).status).toBe(401);
    expect((await webhook(new Request('http://x/api/webhooks/whatsapp', { method: 'POST', body, headers: { 'x-hub-signature-256': sig } }))).status).toBe(200);
    expect((await getPool().query('SELECT status FROM messages WHERE id = $1', [rows[0].id])).rows[0].status).toBe('delivered');
    await expect(getPool().query('DELETE FROM messages WHERE id = $1', [rows[0].id])).rejects.toThrow(/permanent/);
  });
});

describe('provider settings (008 US4)', () => {
  it('stores secrets encrypted and never returns them; test sends are logged; Super Admin only', async () => {
    const sa = await person(['super_admin']);
    const admin = await person(['admin']);
    const res = await putProvider(makeReq('PUT', '/x', { ...sa.as, body: { config: { host: 'smtp.example.com', from: 'ops@artoholic.in' }, secret: 'smtp-password-123' } }), { params: { channel: 'email' } });
    const view = await res.json();
    expect(view).toMatchObject({ hasSecret: true, config: { host: 'smtp.example.com' } });
    expect(JSON.stringify(view)).not.toContain('smtp-password-123');
    const raw = (await getPool().query("SELECT secret_ciphertext FROM provider_settings WHERE channel = 'email'")).rows[0].secret_ciphertext as Buffer;
    expect(raw.toString('utf8')).not.toContain('smtp-password-123');
    expect((await getProvider(makeReq('GET', '/x', admin.as), { params: { channel: 'email' } })).status).toBe(403);
    await putProvider(makeReq('PUT', '/x', { ...sa.as, body: { config: {} } }), { params: { channel: 'email' } });
    const t = await (await testSend(makeReq('POST', '/x', { ...sa.as, body: { to: '+919800000099' } }), { params: { channel: 'whatsapp' } })).json();
    expect(t).toMatchObject({ trigger: 'admin.test', status: 'sent' });
    const log = (await (await adminMessages(makeReq('GET', '/x?q=test', sa.as))).json()).items;
    expect(log[0].events.map((e: { status: string }) => e.status)).toEqual(['queued', 'sent']);
    expect((await adminMessages(makeReq('GET', '/x', admin.as))).status).toBe(403);
  });
});

