import { createHmac, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { PoolClient } from 'pg';
import { getPool } from '../../db/client';
import { decryptSecret } from './secrets';

type Db = Pick<PoolClient, 'query'>;

export interface SendResult { providerMessageId: string | null }
export interface WhatsAppProvider {
  name: string;
  sendTemplate(m: { to: string; template: string; language: string; params: string[]; text: string; document?: { url: string; filename: string } }): Promise<SendResult>;
}
export interface EmailProvider {
  name: string;
  send(m: { to: string; subject: string; text: string; html?: string; attachments?: Array<{ filename: string; content: Buffer }> }): Promise<SendResult>;
}
export interface PushProvider {
  name: string;
  /** Returns tokens the push service says are no longer registered. */
  send(tokens: string[], m: { title: string; body: string; data: Record<string, unknown> }): Promise<{ invalidTokens: string[] }>;
}

/** Dev and test stand-in: writes to `dev_outbox`, as if it were the phone or inbox (002). */
const devOutbox = (db: Db, channel: string) => async (to: string, body: string) => {
  await db.query('INSERT INTO dev_outbox (channel, to_address, body) VALUES ($1, $2, $3)', [channel, to, body]);
};

export async function providerConfig(db: Db, channel: 'whatsapp' | 'email'): Promise<{ config: Record<string, string>; secret: string | null }> {
  const { rows } = await db.query<{ config: Record<string, string>; secret_ciphertext: Buffer | null }>('SELECT config, secret_ciphertext FROM provider_settings WHERE channel = $1', [channel]);
  const r = rows[0];
  return { config: r?.config ?? {}, secret: r?.secret_ciphertext ? decryptSecret(r.secret_ciphertext) : null };
}

/** Meta WhatsApp Cloud API (research R3); the secret is a JSON `{ accessToken, appSecret }`. */
function cloudWhatsApp(phoneNumberId: string, accessToken: string): WhatsAppProvider {
  return {
    name: 'cloud',
    async sendTemplate(m) {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', to: m.to.replace(/^\+/, ''), type: 'template',
          template: {
            name: m.template, language: { code: m.language },
            components: [
              ...(m.document ? [{ type: 'header', parameters: [{ type: 'document', document: { link: m.document.url, filename: m.document.filename } }] }] : []),
              ...(m.params.length ? [{ type: 'body', parameters: m.params.map((text) => ({ type: 'text', text })) }] : [])
            ]
          }
        })
      });
      const json = (await res.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message ?? `WhatsApp provider returned ${res.status}`);
      return { providerMessageId: json.messages?.[0]?.id ?? null };
    }
  };
}

export async function whatsappProvider(db: Db = getPool()): Promise<WhatsAppProvider> {
  const { config, secret } = await providerConfig(db, 'whatsapp');
  if (config.provider === 'cloud' && config.phoneNumberId && secret) {
    const s = JSON.parse(secret) as { accessToken?: string };
    if (s.accessToken) return cloudWhatsApp(config.phoneNumberId, s.accessToken);
  }
  const write = devOutbox(db, 'whatsapp');
  return { name: 'mock', async sendTemplate(m) { await write(m.to, m.document ? `${m.text}\n[document: ${m.document.filename}]` : m.text); return { providerMessageId: null }; } };
}

export async function emailProvider(db: Db = getPool()): Promise<EmailProvider> {
  const { config, secret } = await providerConfig(db, 'email');
  if (config.host && config.from) {
    const transport = nodemailer.createTransport({ host: config.host, port: Number(config.port ?? 587), secure: config.secure === 'true', auth: config.user ? { user: config.user, pass: secret ?? '' } : undefined });
    return {
      name: 'smtp',
      async send(m) {
        const info = await transport.sendMail({ from: config.from, to: m.to, subject: m.subject, text: m.text, html: m.html, attachments: m.attachments });
        return { providerMessageId: info.messageId ?? null };
      }
    };
  }
  const write = devOutbox(db, 'email');
  return { name: 'mock', async send(m) { await write(m.to, `${m.subject}\n\n${m.text}${(m.attachments ?? []).map((a) => `\n[attachment: ${a.filename}]`).join('')}`); return { providerMessageId: null }; } };
}

/** Expo push service (research R2): one API for FCM and APNs. */
export function pushProvider(db: Db = getPool()): PushProvider {
  if (process.env.PUSH_PROVIDER === 'expo' || (process.env.NODE_ENV === 'production' && process.env.PUSH_PROVIDER !== 'mock')) {
    return {
      name: 'expo',
      async send(tokens, m) {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(tokens.map((to) => ({ to, title: m.title, body: m.body, data: m.data, sound: 'default' })))
        });
        if (!res.ok) throw new Error(`Push service returned ${res.status}`);
        const json = (await res.json()) as { data?: Array<{ status: string; details?: { error?: string } }> };
        return { invalidTokens: (json.data ?? []).map((d, i) => (d.status === 'error' && d.details?.error === 'DeviceNotRegistered' ? tokens[i]! : null)).filter((x): x is string => !!x) };
      }
    };
  }
  const write = devOutbox(db, 'push');
  return { name: 'mock', async send(tokens, m) { for (const tk of tokens) await write(tk, `${m.title}\n${m.body}\n${String(m.data.path ?? '')}`); return { invalidTokens: [] }; } };
}

/** Meta signs webhook bodies with the app secret (X-Hub-Signature-256). */
export function validWebhookSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', appSecret).update(rawBody).digest('hex'));
  const got = Buffer.from(header.slice(7));
  return expected.length === got.length && timingSafeEqual(expected, got);
}
