import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { normalisePhone } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import type { RequestContext } from '../http/context';
import { writeAudit } from '../audit/write';
import { hashPassword } from './password';
import { assertPasswordAllowed } from './policy';
import { revokeUserSessions } from './sessions';
import { now } from './clock';
import { sendDirect } from '../notifications/sender';

type Channel = 'whatsapp' | 'email';

const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const PER_ACCOUNT_PER_HOUR = 3;
const PER_ADDRESS_PER_HOUR = 10;

function secret(): string {
  const s = process.env.OTP_HASH_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('OTP_HASH_SECRET must be set in production');
  return s ?? 'dev-only-otp-secret';
}

const hmac = (code: string) => createHmac('sha256', secret()).update(code).digest();

async function findUser(identifier: string) {
  const { rows } = await getPool().query<{ id: string; username: string; email: string | null; phone_e164: string | null; status: string }>(
    `SELECT id, username, email, phone_e164, status FROM users
      WHERE username = $1 OR email = $2::citext OR phone_e164 = $3 LIMIT 2`,
    [identifier, identifier.includes('@') ? identifier : null, normalisePhone(identifier)]
  );
  return rows.length === 1 && rows[0]!.status === 'active' ? rows[0]! : null;
}

/**
 * Sends a 6-digit code by WhatsApp and email (002 FR-007). The caller always answers the same
 * generic message, so this never reveals whether an account exists.
 */
export async function requestReset(identifier: string, ctx: RequestContext): Promise<void> {
  const user = await findUser(identifier);
  if (!user) return;
  const hourAgo = new Date(now().getTime() - 60 * 60_000);
  const { rows } = await getPool().query<{ by_user: number; by_addr: number }>(
    `SELECT count(*) FILTER (WHERE user_id = $1)::int AS by_user,
            count(*) FILTER (WHERE network_address = $2)::int AS by_addr
       FROM password_resets WHERE requested_at > $3`,
    [user.id, ctx.ip, hourAgo]
  );
  if (rows[0]!.by_user >= PER_ACCOUNT_PER_HOUR || (ctx.ip && rows[0]!.by_addr >= PER_ADDRESS_PER_HOUR)) return;

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const channels: Channel[] = [];
  if (user.phone_e164) channels.push('whatsapp');
  if (user.email) channels.push('email');
  const t0 = now();
  await withTransaction(async (tx) => {
    await tx.query(
      'INSERT INTO password_resets (user_id, code_hmac, channels, requested_at, expires_at, network_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, hmac(code), channels, t0, new Date(t0.getTime() + CODE_TTL_MS), ctx.ip]
    );
    const text = (c: string) => `Your Artoholic password reset code is ${c}. It expires in 10 minutes. Do not share it.`;
    for (const channel of channels) {
      await sendDirect(tx, { channel, to: channel === 'whatsapp' ? user.phone_e164! : user.email!, userId: user.id, trigger: 'auth.password_reset',
        subject: 'Artoholic password reset code', text: text(code), redactedText: text('••••••'), recordType: 'user', recordId: user.id });
    }
    await writeAudit(tx, { action: 'auth.reset_requested', actorUserId: user.id, entityType: 'user', entityId: user.id, after: { channels }, ctx });
  });
}

/** Verifies the latest code (10 min, 5 attempts), sets the password, ends every session. */
export async function completeReset(identifier: string, code: string, newPassword: string, ctx: RequestContext): Promise<void> {
  const user = await findUser(identifier);
  if (!user) throw new ApiError('RESET_CODE_INVALID');
  assertPasswordAllowed(newPassword, [user.username, user.email, user.phone_e164]);
  // The wrong-code attempt must be counted even though the request fails, so the transaction
  // commits and the refusal is raised afterwards.
  const ok = await withTransaction(async (tx) => {
    const { rows } = await tx.query<{ id: string; code_hmac: Buffer; expires_at: Date; attempts: number; used_at: Date | null }>(
      'SELECT id, code_hmac, expires_at, attempts, used_at FROM password_resets WHERE user_id = $1 ORDER BY requested_at DESC LIMIT 1 FOR UPDATE',
      [user.id]
    );
    const r = rows[0];
    if (!r || r.used_at || r.expires_at <= now() || r.attempts >= MAX_ATTEMPTS) return false;
    const given = hmac(code);
    if (given.length !== r.code_hmac.length || !timingSafeEqual(given, r.code_hmac)) {
      await tx.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1', [r.id]);
      return false;
    }
    await tx.query('UPDATE password_resets SET used_at = $2 WHERE id = $1', [r.id, now()]);
    await tx.query(
      'UPDATE users SET password_hash = $2, must_change_password = false, password_changed_at = $3, updated_at = $3 WHERE id = $1',
      [user.id, await hashPassword(newPassword), now()]
    );
    await revokeUserSessions(tx, user.id);
    await writeAudit(tx, { action: 'auth.reset_completed', actorUserId: user.id, entityType: 'user', entityId: user.id, ctx });
    return true;
  });
  if (!ok) throw new ApiError('RESET_CODE_INVALID');
}
