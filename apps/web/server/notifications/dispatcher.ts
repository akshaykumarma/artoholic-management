import type { PoolClient } from 'pg';
import { istDate, renderNotification, triggerDef, type DeliveryChannel } from '@artoholic/shared';
import { withTransaction } from '../../db/client';
import { logger } from '../http/logger';
import { now } from '../auth/clock';
import { adminIds } from '../events/recipients';
import { redact } from './redact';

type Tx = Pick<PoolClient, 'query'>;
const IST_MS = 330 * 60_000;
const appUrl = (path: string) => `${process.env.APP_URL ?? 'http://localhost:3000'}${path}`;

/** When quiet hours (IST) hold back push and WhatsApp: the instant they end, or null if not quiet now. */
export function quietUntil(at: Date, q: { start: number; end: number } | null): Date | null {
  if (!q || q.start === q.end) return null;
  const local = new Date(at.getTime() + IST_MS);
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const inside = q.start < q.end ? minute >= q.start && minute < q.end : minute >= q.start || minute < q.end;
  if (!inside) return null;
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  let end = day + q.end * 60_000 - IST_MS;
  if (end <= at.getTime()) end += 86_400_000;
  return new Date(end);
}

async function recipientsFor(tx: Tx, trigger: string, payload: Record<string, unknown>): Promise<string[]> {
  const ids = triggerDef(trigger).recipients === 'admins' ? await adminIds(tx) : Array.isArray(payload.recipientIds) ? (payload.recipientIds as string[]) : [];
  if (!ids.length) return [];
  const { rows } = await tx.query<{ id: string }>("SELECT id FROM users WHERE id = ANY($1::uuid[]) AND status = 'active'", [[...new Set(ids)]]);
  return rows.map((r) => r.id);
}

/** Channels for one user: the trigger's defaults minus anything they turned off for the group (US3). */
async function channelsFor(tx: Tx, userId: string, trigger: string): Promise<DeliveryChannel[]> {
  const def = triggerDef(trigger);
  const { rows } = await tx.query<{ channel: DeliveryChannel; enabled: boolean }>('SELECT channel, enabled FROM channel_preferences WHERE user_id = $1 AND grp = $2', [userId, def.group]);
  return def.channels.filter((c) => rows.find((r) => r.channel === c)?.enabled !== false);
}

interface MappingRow { template_name: string; language: string; variables: string[]; body_text: string }

/** Renders the logged text for WhatsApp/email: the approved template body with its variables, else title/summary/link. */
export function renderMessage(m: MappingRow | null, payload: Record<string, unknown>, fallback: { title: string; body: string; path: string }) {
  const params = (m?.variables ?? []).map((v) => String(payload[v] ?? ''));
  const text = m?.body_text
    ? params.reduce((s, p, i) => s.split(`{{${i + 1}}}`).join(p), m.body_text)
    : [fallback.title, fallback.body, appUrl(fallback.path)].filter(Boolean).join('\n');
  return { params, text };
}

/**
 * Turns outbox rows into in-app notifications and delivery jobs (research R1): one per recipient and
 * channel; the person who caused it gets in-app only; repeats within 60 s merge (R7); quiet hours
 * defer push and WhatsApp (R6) except damage alerts to Admins.
 */
export async function processOutbox(limit = 200): Promise<number> {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ id: string; trigger: string; record_type: string | null; record_id: string | null; payload: Record<string, unknown>; actor_user_id: string | null }>(
      'SELECT id, trigger, record_type, record_id, payload, actor_user_id FROM notification_outbox WHERE processed_at IS NULL ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED', [limit]
    );
    const at = now();
    const admins = new Set(await adminIds(tx));
    for (const o of rows) {
      const def = triggerDef(o.trigger);
      const view = renderNotification(o.trigger, o.payload);
      for (const userId of await recipientsFor(tx, o.trigger, o.payload)) {
        const dedupe = `${o.trigger}|${o.record_id ?? ''}|${userId}`;
        const { rows: recent } = await tx.query<{ id: string }>(
          "SELECT id FROM notifications WHERE dedupe_key = $1 AND created_at > $2::timestamptz - interval '60 seconds' ORDER BY created_at DESC LIMIT 1", [dedupe, at]
        );
        if (recent[0]) {
          await tx.query('UPDATE notifications SET title = $2, body = $3, path = $4, created_at = $5, read_at = NULL WHERE id = $1', [recent[0].id, view.title, view.body, view.path, at]);
          continue;
        }
        const { rows: n } = await tx.query<{ id: string }>(
          'INSERT INTO notifications (user_id, trigger, record_type, record_id, title, body, path, created_at, dedupe_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
          [userId, o.trigger, o.record_type, o.record_id, view.title, view.body, view.path, at, dedupe]
        );
        if (userId === o.actor_user_id) continue;
        const { rows: u } = await tx.query<{ phone: string | null; email: string | null; qs: number | null; qe: number | null; qon: boolean | null }>(
          `SELECT u.phone_e164 AS phone, u.email, q.start_minute_ist AS qs, q.end_minute_ist AS qe, q.enabled AS qon FROM users u LEFT JOIN quiet_hours q ON q.user_id = u.id WHERE u.id = $1`, [userId]
        );
        const user = u[0]!;
        const bypass = def.bypassQuietHours && admins.has(userId);
        const held = !bypass && user.qon && user.qs !== null ? quietUntil(at, { start: user.qs, end: user.qe! }) : null;
        for (const ch of await channelsFor(tx, userId, o.trigger)) {
          const sendAfter = ch === 'email' ? at : held ?? at;
          if (ch === 'push') {
            await tx.query('INSERT INTO channel_jobs (channel, user_id, notification_id, payload, send_after) VALUES ($1, $2, $3, $4, $5)',
              ['push', userId, n[0]!.id, JSON.stringify({ title: view.title, body: view.body, data: { path: view.path, trigger: o.trigger, recordId: o.record_id } }), sendAfter]);
            continue;
          }
          const to = ch === 'whatsapp' ? user.phone : user.email;
          if (!to) continue;
          const { rows: map } = await tx.query<MappingRow>('SELECT template_name, language, variables, body_text FROM template_mappings WHERE trigger = $1 AND channel = $2', [o.trigger, ch]);
          const mapping = map[0] ?? null;
          const msg = renderMessage(mapping, o.payload, view);
          const skipped = ch === 'whatsapp' && !mapping;
          const file = typeof o.payload.fileKey === 'string' ? { name: String(o.payload.fileName ?? 'report.xlsx'), size: Number(o.payload.fileBytes ?? 0), key: o.payload.fileKey } : null;
          const { rows: m } = await tx.query<{ id: string }>(
            `INSERT INTO messages (channel, to_address, user_id, trigger, template_name, language, rendered_text, attachments, record_type, record_id, queued_at, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
            [ch, to, userId, o.trigger, mapping?.template_name ?? null, mapping?.language ?? null, redact(o.trigger, msg.text), JSON.stringify(file ? [file] : []), o.record_type, o.record_id, at, skipped ? 'skipped' : 'queued']
          );
          await tx.query('INSERT INTO message_events (message_id, status, detail, at) VALUES ($1, $2, $3, $4)', [m[0]!.id, skipped ? 'skipped' : 'queued', skipped ? 'no template' : null, at]);
          if (skipped) continue;
          await tx.query('INSERT INTO channel_jobs (channel, user_id, message_id, notification_id, payload, send_after) VALUES ($1, $2, $3, $4, $5, $6)',
            [ch, userId, m[0]!.id, n[0]!.id, JSON.stringify({ subject: view.title, text: msg.text, params: msg.params, file, downloadPath: o.payload.downloadPath ?? null }), sendAfter]);
        }
      }
      await tx.query('UPDATE notification_outbox SET processed_at = $2 WHERE id = $1', [o.id, at]);
    }
    if (rows.length) logger.info('notifications dispatched', { outbox: rows.length, day: istDate(at) });
    return rows.length;
  });
}

