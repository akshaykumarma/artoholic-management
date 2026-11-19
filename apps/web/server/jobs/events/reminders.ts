import type { PoolClient } from 'pg';
import { istDate, istInstant } from '@artoholic/shared';
import { withTransaction } from '../../../db/client';
import { emit } from '../../notifications/outbox';
import { adminIds, assigneeIds } from '../../events/recipients';

export const EVENT_REMINDERS_JOB = 'event-reminders';
type Tx = Pick<PoolClient, 'query'>;

async function once(tx: Tx, eventId: string, kind: string, day: string): Promise<boolean> {
  const { rowCount } = await tx.query('INSERT INTO event_reminders (event_id, kind, day) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [eventId, kind, day]);
  return !!rowCount;
}

/**
 * Reminders (005 US6, research R7), idempotent per event, kind and IST day:
 * Store Managers 24 h before leaving if dispatch isn't under way; Event Managers from 09:00 IST
 * on the return date if the return isn't; Admins from 08:00 IST on the leave date of an event
 * that is still over-booked.
 */
export async function runEventReminders(at: Date = new Date()): Promise<number> {
  const today = istDate(at);
  let sent = 0;
  await withTransaction(async (tx) => {
    const { rows: dispatch } = await tx.query<{ id: string; number: string; name: string; leave_warehouse_at: Date }>(
      `SELECT id, number, name, leave_warehouse_at FROM events
        WHERE status = 'scheduled' AND leave_warehouse_at > $1 AND leave_warehouse_at - interval '24 hours' <= $1`,
      [at]
    );
    for (const e of dispatch) {
      if (!(await once(tx, e.id, 'dispatch', istDate(e.leave_warehouse_at)))) continue;
      const sms = await assigneeIds(tx, e.id, 'store_manager');
      await emit(tx, 'event.dispatch_reminder', { recordType: 'event', recordId: e.id,
        payload: { eventId: e.id, number: e.number, name: e.name, leaveWarehouseAt: new Date(e.leave_warehouse_at).toISOString(), link: `/events/${e.id}`, recipientIds: sms.length ? sms : await adminIds(tx) } });
      sent++;
    }
    if (at >= istInstant(today, 9)) {
      const { rows } = await tx.query<{ id: string; number: string; name: string }>(
        "SELECT id, number, name FROM events WHERE status = 'at_site' AND expected_return_date = $1", [today]
      );
      for (const e of rows) {
        if (!(await once(tx, e.id, 'return', today))) continue;
        await emit(tx, 'event.return_reminder', { recordType: 'event', recordId: e.id,
          payload: { eventId: e.id, number: e.number, name: e.name, link: `/events/${e.id}`, recipientIds: await assigneeIds(tx, e.id, 'event_manager') } });
        sent++;
      }
    }
    if (at >= istInstant(today, 8)) {
      const { rows } = await tx.query<{ id: string; number: string; name: string }>(
        `SELECT e.id, e.number, e.name FROM events e WHERE e.status = 'scheduled' AND (e.leave_warehouse_at AT TIME ZONE 'Asia/Kolkata')::date = $1
           AND EXISTS (SELECT 1 FROM overbooking_warnings o WHERE o.event_id = e.id AND o.resolved_at IS NULL)`, [today]
      );
      for (const e of rows) {
        if (!(await once(tx, e.id, 'overbooked', today))) continue;
        await emit(tx, 'event.overbooking_reminder', { recordType: 'event', recordId: e.id,
          payload: { eventId: e.id, number: e.number, name: e.name, link: `/events/${e.id}`, recipientIds: await adminIds(tx) } });
        sent++;
      }
    }
  });
  return sent;
}
