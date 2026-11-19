import type { PoolClient } from 'pg';
import { getPool, withTransaction } from '../../db/client';
import { logger } from '../http/logger';
import { now } from '../auth/clock';
import { emailProvider, pushProvider, whatsappProvider } from './providers';

type Tx = Pick<PoolClient, 'query'>;
/** Retries at 1, 5 and 9 minutes (≈ 15 minutes), then failed and the Super Admin is told (FR-008, R8). */
const RETRY_MINUTES = [1, 5, 9];

async function markMessage(tx: Tx, messageId: string, status: string, detail: string | null, extra: { providerId?: string | null; sentAt?: Date } = {}) {
  await tx.query(
    `UPDATE messages SET status = $2, provider_message_id = COALESCE($3, provider_message_id), sent_at = COALESCE($4, sent_at) WHERE id = $1`,
    [messageId, status, extra.providerId ?? null, extra.sentAt ?? null]
  );
  await tx.query('INSERT INTO message_events (message_id, status, detail, at) VALUES ($1, $2, $3, $4)', [messageId, status, detail, now()]);
}

async function alertSuperAdmin(tx: Tx, m: { id: string; channel: string; to: string; reason: string }) {
  const { rows } = await tx.query<{ id: string }>("SELECT u.id FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'super_admin' WHERE u.status = 'active'");
  if (rows.length) {
    await tx.query(
      `INSERT INTO notification_outbox (trigger, record_type, record_id, payload) VALUES ('message.failed', 'message', $1, $2)`,
      [m.id, JSON.stringify({ channel: m.channel, to: m.to, reason: m.reason.slice(0, 200), recipientIds: rows.map((r) => r.id) })]
    );
  }
}

interface Job { id: string; channel: 'push' | 'whatsapp' | 'email'; user_id: string | null; message_id: string | null; payload: Record<string, unknown> | null; attempts: number }

async function deliver(tx: Tx, job: Job) {
  if (job.channel === 'push') {
    const { rows } = await tx.query<{ expo_token: string }>(
      `SELECT r.expo_token FROM push_registrations r JOIN users u ON u.id = r.user_id AND u.status = 'active'
         LEFT JOIN sessions s ON s.id = r.session_id
        WHERE r.user_id = $1 AND (r.session_id IS NULL OR (s.revoked_at IS NULL AND s.expires_at > $2))`, [job.user_id, now()]
    );
    if (!rows.length) return;
    const p = job.payload as { title: string; body: string; data: Record<string, unknown> };
    const { invalidTokens } = await pushProvider(tx).send(rows.map((r) => r.expo_token), p);
    if (invalidTokens.length) await tx.query('DELETE FROM push_registrations WHERE expo_token = ANY($1)', [invalidTokens]);
    return;
  }
  const { rows } = await tx.query<{ to_address: string; template_name: string | null; language: string | null; attachments: Array<{ name: string; key?: string }> }>(
    'SELECT to_address, template_name, language, attachments FROM messages WHERE id = $1', [job.message_id]
  );
  const m = rows[0]!;
  const p = job.payload as { subject: string; text: string; params: string[] };
  const result = job.channel === 'whatsapp'
    ? await (await whatsappProvider(tx)).sendTemplate({ to: m.to_address, template: m.template_name!, language: m.language ?? 'en', params: p.params ?? [], text: p.text })
    : await (await emailProvider(tx)).send({ to: m.to_address, subject: p.subject, text: p.text });
  await markMessage(tx, job.message_id!, 'sent', null, { providerId: result.providerMessageId, sentAt: now() });
}

/** Sends due push, WhatsApp and email jobs. */
export async function processJobs(limit = 100): Promise<number> {
  const { rows } = await getPool().query<{ id: string }>("SELECT id FROM channel_jobs WHERE status = 'pending' AND send_after <= $1 ORDER BY send_after LIMIT $2", [now(), limit]);
  let done = 0;
  for (const r of rows) {
    await withTransaction(async (tx) => {
      const { rows: jr } = await tx.query<Job>("SELECT id, channel, user_id, message_id, payload, attempts FROM channel_jobs WHERE id = $1 AND status = 'pending' FOR UPDATE SKIP LOCKED", [r.id]);
      const job = jr[0];
      if (!job) return;
      try {
        await tx.query('SAVEPOINT deliver');
        await deliver(tx, job);
        await tx.query('RELEASE SAVEPOINT deliver');
        await tx.query("UPDATE channel_jobs SET status = 'done', payload = NULL WHERE id = $1", [job.id]);
        done++;
      } catch (err) {
        await tx.query('ROLLBACK TO SAVEPOINT deliver');
        const reason = (err as Error).message;
        const attempts = job.attempts + 1;
        if (attempts <= RETRY_MINUTES.length) {
          await tx.query('UPDATE channel_jobs SET attempts = $2, last_error = $3, send_after = $4 WHERE id = $1',
            [job.id, attempts, reason, new Date(now().getTime() + RETRY_MINUTES[attempts - 1]! * 60_000)]);
          if (job.message_id) await markMessage(tx, job.message_id, 'retrying', reason);
        } else {
          await tx.query("UPDATE channel_jobs SET status = 'failed', attempts = $2, last_error = $3, payload = NULL WHERE id = $1", [job.id, attempts, reason]);
          if (job.message_id) {
            await markMessage(tx, job.message_id, 'failed', reason);
            const { rows: m } = await tx.query<{ channel: string; to_address: string }>('SELECT channel, to_address FROM messages WHERE id = $1', [job.message_id]);
            await alertSuperAdmin(tx, { id: job.message_id, channel: m[0]!.channel, to: m[0]!.to_address, reason });
          }
          logger.error('delivery failed', { jobId: job.id, channel: job.channel, reason });
        }
      }
    });
  }
  return done;
}

/** Delivery statuses from the provider webhook (US5): sent, delivered, read, failed. */
export async function recordProviderStatus(providerMessageId: string, status: string, detail: string | null) {
  await withTransaction(async (tx) => {
    const { rows } = await tx.query<{ id: string }>('SELECT id FROM messages WHERE provider_message_id = $1', [providerMessageId]);
    if (rows[0] && ['sent', 'delivered', 'read', 'failed'].includes(status)) await markMessage(tx, rows[0].id, status, detail);
  });
}

/**
 * A message that must go now, such as a password-reset code (002): logged with the code redacted,
 * sent at once, and retried like any other if the provider fails.
 */
export async function sendDirect(tx: Tx, m: { channel: 'whatsapp' | 'email'; to: string; userId: string | null; trigger: string; subject: string; text: string; redactedText: string; recordType?: string; recordId?: string }) {
  const { rows: map } = await tx.query<{ template_name: string; language: string }>('SELECT template_name, language FROM template_mappings WHERE trigger = $1 AND channel = $2', [m.trigger, m.channel]);
  const { rows } = await tx.query<{ id: string }>(
    `INSERT INTO messages (channel, to_address, user_id, trigger, template_name, language, rendered_text, record_type, record_id, queued_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [m.channel, m.to, m.userId, m.trigger, map[0]?.template_name ?? null, map[0]?.language ?? null, m.redactedText, m.recordType ?? null, m.recordId ?? null, now()]
  );
  const id = rows[0]!.id;
  await tx.query('INSERT INTO message_events (message_id, status, at) VALUES ($1, $2, $3)', [id, 'queued', now()]);
  const params = (m.text.match(/(?<!\d)\d{4,8}(?!\d)/g) ?? []).slice(0, 1);
  const job = { subject: m.subject, text: m.text, params };
  try {
    const result = m.channel === 'whatsapp'
      ? await (await whatsappProvider(tx)).sendTemplate({ to: m.to, template: map[0]?.template_name ?? m.trigger, language: map[0]?.language ?? 'en', params, text: m.text })
      : await (await emailProvider(tx)).send({ to: m.to, subject: m.subject, text: m.text });
    await markMessage(tx, id, 'sent', null, { providerId: result.providerMessageId, sentAt: now() });
  } catch (err) {
    await markMessage(tx, id, 'retrying', (err as Error).message);
    await tx.query('INSERT INTO channel_jobs (channel, user_id, message_id, payload, send_after, attempts) VALUES ($1, $2, $3, $4, $5, 1)',
      [m.channel, m.userId, id, JSON.stringify(job), new Date(now().getTime() + 60_000)]);
  }
}
