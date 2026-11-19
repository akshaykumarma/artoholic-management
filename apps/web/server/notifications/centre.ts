import { DELIVERY_CHANNELS, NOTIFICATION_GROUPS, TRIGGERS, type Notification, type Preferences } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { now } from '../auth/clock';
import type { Authenticated } from '../auth/sessions';

const DAYS_90 = 90 * 86_400_000;
const map = (r: { id: string; trigger: string; title: string; body: string; path: string | null; created_at: Date; read_at: Date | null }): Notification => ({
  id: r.id, trigger: r.trigger, title: r.title, body: r.body, path: r.path, createdAt: new Date(r.created_at).toISOString(), readAt: r.read_at ? new Date(r.read_at).toISOString() : null
});

export async function unreadCount(auth: Authenticated): Promise<number> {
  const { rows } = await getPool().query<{ n: number }>('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL AND created_at > $2', [auth.user.id, new Date(now().getTime() - DAYS_90)]);
  return rows[0]!.n;
}

/** Newest first, last 90 days (US2). */
export async function listNotifications(auth: Authenticated, q: { cursor?: number; unread?: boolean }) {
  const limit = 50;
  const offset = q.cursor ?? 0;
  const { rows } = await getPool().query(
    `SELECT id, trigger, title, body, path, created_at, read_at FROM notifications
      WHERE user_id = $1 AND created_at > $2 AND (NOT $3::boolean OR read_at IS NULL) ORDER BY created_at DESC LIMIT ${limit + 1} OFFSET $4`,
    [auth.user.id, new Date(now().getTime() - DAYS_90), q.unread ?? false, offset]
  );
  return { items: rows.slice(0, limit).map(map), nextCursor: rows.length > limit ? String(offset + limit) : null, unread: await unreadCount(auth) };
}

export async function markRead(auth: Authenticated, id: string) {
  const r = await getPool().query('UPDATE notifications SET read_at = COALESCE(read_at, $3) WHERE id = $1 AND user_id = $2', [id, auth.user.id, now()]);
  if (!r.rowCount) throw new ApiError('NOT_FOUND');
  return { unread: await unreadCount(auth) };
}

export async function markAllRead(auth: Authenticated) {
  await getPool().query('UPDATE notifications SET read_at = $2 WHERE user_id = $1 AND read_at IS NULL', [auth.user.id, now()]);
  return { unread: 0 };
}

/** In-app entries go after 90 days; the WhatsApp/email message log is permanent. */
export async function purgeOldNotifications(): Promise<number> {
  const r = await getPool().query('DELETE FROM notifications WHERE created_at < $1', [new Date(now().getTime() - DAYS_90)]);
  return r.rowCount ?? 0;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/** Defaults are the channels any trigger in the group uses; the user can turn each off (US3). */
export async function getPreferences(auth: Authenticated): Promise<Preferences> {
  const { rows } = await getPool().query<{ grp: string; channel: string; enabled: boolean }>('SELECT grp, channel, enabled FROM channel_preferences WHERE user_id = $1', [auth.user.id]);
  const groups = Object.fromEntries(NOTIFICATION_GROUPS.map((g) => {
    const defaults = new Set(Object.values(TRIGGERS).filter((d) => d.group === g).flatMap((d) => d.channels));
    return [g, Object.fromEntries(DELIVERY_CHANNELS.map((c) => [c, rows.find((r) => r.grp === g && r.channel === c)?.enabled ?? defaults.has(c)]))];
  })) as Preferences['groups'];
  const { rows: q } = await getPool().query<{ start_minute_ist: number; end_minute_ist: number; enabled: boolean }>('SELECT * FROM quiet_hours WHERE user_id = $1', [auth.user.id]);
  return { groups, quietHours: q[0] ? { enabled: q[0].enabled, start: hhmm(q[0].start_minute_ist), end: hhmm(q[0].end_minute_ist) } : { enabled: false, start: '22:00', end: '07:00' } };
}

export async function setPreferences(auth: Authenticated, p: Preferences): Promise<Preferences> {
  await withTransaction(async (tx) => {
    for (const [g, chans] of Object.entries(p.groups)) {
      for (const [c, enabled] of Object.entries(chans)) {
        await tx.query(
          `INSERT INTO channel_preferences (user_id, grp, channel, enabled) VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, grp, channel) DO UPDATE SET enabled = EXCLUDED.enabled`, [auth.user.id, g, c, enabled]
        );
      }
    }
    await tx.query(
      `INSERT INTO quiet_hours (user_id, start_minute_ist, end_minute_ist, enabled) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET start_minute_ist = EXCLUDED.start_minute_ist, end_minute_ist = EXCLUDED.end_minute_ist, enabled = EXCLUDED.enabled`,
      [auth.user.id, minutes(p.quietHours.start), minutes(p.quietHours.end), p.quietHours.enabled]
    );
  });
  return getPreferences(auth);
}

/** Push tokens are tied to the device session: signing out or deactivation stops push at once. */
export async function registerPush(auth: Authenticated, token: string, platform: string) {
  await getPool().query(
    `INSERT INTO push_registrations (user_id, session_id, platform, expo_token, updated_at) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (expo_token) DO UPDATE SET user_id = EXCLUDED.user_id, session_id = EXCLUDED.session_id, platform = EXCLUDED.platform, updated_at = EXCLUDED.updated_at`,
    [auth.user.id, auth.session.id, platform, token, now()]
  );
  return { registered: true };
}

