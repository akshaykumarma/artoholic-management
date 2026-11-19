import type { PoolClient } from 'pg';
import { logger } from '../http/logger';

export type Channel = 'whatsapp' | 'email';

/**
 * Message channel used until 008 ships real WhatsApp and email delivery. It writes to the
 * `dev_outbox` table (standing in for the recipient's phone or inbox) and logs a redacted line.
 */
export async function sendMessage(
  db: Pick<PoolClient, 'query'>,
  msg: { channel: Channel; to: string; body: string; redactedBody: string }
): Promise<void> {
  await db.query('INSERT INTO dev_outbox (channel, to_address, body) VALUES ($1, $2, $3)', [msg.channel, msg.to, msg.body]);
  logger.info('message queued (dev channel)', { channel: msg.channel, to: msg.to, body: msg.redactedBody });
}
