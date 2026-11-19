import type { Message, TemplateMapping } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';
import { encryptSecret } from './secrets';
import { sendDirect } from './sender';

/** Secrets are write-only: reads say only whether one is set (FR-009). */
export async function getProvider(channel: 'whatsapp' | 'email') {
  const { rows } = await getPool().query<{ config: Record<string, string>; has_secret: boolean; updated_at: Date }>(
    'SELECT config, secret_ciphertext IS NOT NULL AS has_secret, updated_at FROM provider_settings WHERE channel = $1', [channel]
  );
  return { channel, config: rows[0]?.config ?? {}, hasSecret: rows[0]?.has_secret ?? false, updatedAt: rows[0] ? new Date(rows[0].updated_at).toISOString() : null };
}

export async function setProvider(auth: Authenticated, channel: 'whatsapp' | 'email', input: { config: Record<string, string>; secret?: string }, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO provider_settings (channel, config, secret_ciphertext, updated_by, updated_at) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (channel) DO UPDATE SET config = EXCLUDED.config, secret_ciphertext = COALESCE(EXCLUDED.secret_ciphertext, provider_settings.secret_ciphertext),
         updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at`,
      [channel, JSON.stringify(input.config), input.secret ? encryptSecret(input.secret) : null, auth.user.id, now()]
    );
    await writeAudit(tx, { action: 'notifications.provider_updated', actorUserId: auth.user.id, entityType: 'provider', entityId: channel,
      after: { config: input.config, secretChanged: !!input.secret }, ctx });
  });
  return getProvider(channel);
}

export async function listTemplates(): Promise<TemplateMapping[]> {
  const { rows } = await getPool().query<{ trigger: string; channel: 'whatsapp' | 'email'; template_name: string; language: string; variables: string[]; body_text: string }>(
    'SELECT trigger, channel, template_name, language, variables, body_text FROM template_mappings ORDER BY trigger, channel'
  );
  return rows.map((r) => ({ trigger: r.trigger, channel: r.channel, templateName: r.template_name, language: r.language, variables: r.variables, bodyText: r.body_text }));
}

export async function setTemplates(auth: Authenticated, items: TemplateMapping[], ctx: RequestContext) {
  await withTransaction(async (tx) => {
    for (const m of items) {
      await tx.query(
        `INSERT INTO template_mappings (trigger, channel, template_name, language, variables, body_text, updated_by, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (trigger, channel) DO UPDATE SET template_name = EXCLUDED.template_name, language = EXCLUDED.language, variables = EXCLUDED.variables,
           body_text = EXCLUDED.body_text, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at`,
        [m.trigger, m.channel, m.templateName, m.language, JSON.stringify(m.variables), m.bodyText, auth.user.id, now()]
      );
    }
    await writeAudit(tx, { action: 'notifications.templates_updated', actorUserId: auth.user.id, entityType: 'template_mappings', after: { count: items.length }, ctx });
  });
  return listTemplates();
}

/** Test message (US4-2): logged like any other, so its status shows in the message log. */
export async function sendTest(auth: Authenticated, channel: 'whatsapp' | 'email', to: string) {
  await withTransaction((tx) => sendDirect(tx, {
    channel, to, userId: auth.user.id, trigger: 'admin.test', subject: 'Artoholic test message',
    text: 'This is a test message from Artoholic.', redactedText: 'This is a test message from Artoholic.'
  }));
  const { rows } = await getPool().query<{ id: string }>("SELECT id FROM messages WHERE trigger = 'admin.test' ORDER BY queued_at DESC LIMIT 1");
  return (await messagesWhere('m.id = $1', [rows[0]!.id]))[0]!;
}

async function messagesWhere(where: string, params: unknown[], limit = 200): Promise<Message[]> {
  const { rows } = await getPool().query(
    `SELECT m.*, COALESCE((SELECT json_agg(json_build_object('status', e.status, 'detail', e.detail, 'at', e.at) ORDER BY e.id) FROM message_events e WHERE e.message_id = m.id), '[]') AS events
       FROM messages m WHERE ${where} ORDER BY m.queued_at DESC LIMIT ${limit}`, params
  );
  return rows.map((m) => ({
    id: m.id, channel: m.channel, toAddress: m.to_address, trigger: m.trigger, templateName: m.template_name, renderedText: m.rendered_text,
    attachments: m.attachments, recordType: m.record_type, recordId: m.record_id, status: m.status, queuedAt: new Date(m.queued_at).toISOString(),
    sentAt: m.sent_at ? new Date(m.sent_at).toISOString() : null,
    events: (m.events as Array<{ status: string; detail: string | null; at: string }>).map((e) => ({ ...e, at: new Date(e.at).toISOString() }))
  }));
}

/** The full permanent log (Super Admin → Login & activity), filterable. */
export async function listMessages(q: { channel?: string; status?: string; from?: string; to?: string; q?: string }) {
  return messagesWhere(
    `($1::text IS NULL OR m.channel = $1) AND ($2::text IS NULL OR m.status = $2) AND ($3::date IS NULL OR m.queued_at >= $3::date)
     AND ($4::date IS NULL OR m.queued_at < $4::date + 1) AND ($5::text IS NULL OR m.to_address ILIKE '%' || $5 || '%' OR m.rendered_text ILIKE '%' || $5 || '%' OR m.trigger ILIKE '%' || $5 || '%')`,
    [q.channel ?? null, q.status ?? null, q.from ?? null, q.to ?? null, q.q?.trim() || null], 500
  );
}

export async function recordMessages(recordType: string, recordId: string) {
  return messagesWhere('m.record_type = $1 AND m.record_id = $2', [recordType, recordId]);
}

export function requireSuperAdmin(auth: Authenticated) {
  if (!auth.user.roles.includes('super_admin')) throw new ApiError('FORBIDDEN');
}
