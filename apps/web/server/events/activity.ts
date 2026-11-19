import { getPool } from '../../db/client';
import type { Authenticated } from '../auth/sessions';
import { requireEventAccess } from './events';

/** Everything that happened to an event (FR-015): audit entries, notifications, and every WhatsApp/email message in full (owner rule). */
export async function eventActivity(auth: Authenticated, eventId: string) {
  await requireEventAccess(auth, eventId);
  const { rows } = await getPool().query<{ at: Date; actor: string | null; action: string; detail: Record<string, unknown> | null }>(
    `SELECT a.occurred_at AS at, u.full_name AS actor, a.action, COALESCE(a.after, a.before) AS detail
       FROM audit_entries a LEFT JOIN users u ON u.id = a.actor_user_id WHERE a.entity_type = 'event' AND a.entity_id = $1
     UNION ALL
     SELECT o.created_at, u.full_name, 'message.' || o.trigger, o.payload
       FROM notification_outbox o LEFT JOIN users u ON u.id = o.actor_user_id WHERE o.record_type = 'event' AND o.record_id = $1
     UNION ALL
     SELECT m.queued_at, NULL, m.channel || '.' || m.status,
            jsonb_build_object('to', m.to_address, 'trigger', m.trigger, 'template', m.template_name, 'text', m.rendered_text)
       FROM messages m WHERE m.record_type = 'event' AND m.record_id = $1
     ORDER BY 1 DESC LIMIT 500`,
    [eventId]
  );
  return { items: rows.map((r) => ({ at: new Date(r.at).toISOString(), actor: r.actor, action: r.action, detail: r.detail })) };
}
