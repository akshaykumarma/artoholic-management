import { withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import { emit } from '../notifications/outbox';
import { reserveNow } from '../events/reservations';
import { assigneeIds } from '../events/recipients';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';
import { ensureSteps } from './steps';

/** Admin adds items to a live event: a new round with its own four steps, reserved like any line (US8). */
export async function addRound(auth: Authenticated, eventId: string, lines: Array<{ itemId: string; plannedQty: string; warehouseId: string }>, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const { rows: ev } = await tx.query<{ status: string; number: string; name: string }>('SELECT status, number, name FROM events WHERE id = $1 FOR UPDATE', [eventId]);
    if (!ev[0]) throw new ApiError('NOT_FOUND');
    if (!['dispatching', 'in_transit', 'at_site'].includes(ev[0].status)) throw new ApiError('EVENT_STATE', { status: ev[0].status }, 'Add items to a Draft or Scheduled event by editing it; rounds are for live events.');
    const { rows: mx } = await tx.query<{ r: number }>('SELECT COALESCE(max(round), 1) AS r FROM event_lines WHERE event_id = $1', [eventId]);
    const round = mx[0]!.r + 1;
    for (const [i, l] of lines.entries()) {
      const { rows } = await tx.query<{ id: string }>('INSERT INTO event_lines (event_id, item_id, planned_qty, round, position) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [eventId, l.itemId, l.plannedQty, round, 1000 * round + i]);
      const reserved = await reserveNow(tx, eventId, l.itemId, l.warehouseId, l.plannedQty, auth.user.id, ctx);
      await tx.query('INSERT INTO event_line_sources (event_line_id, source_type, warehouse_id, planned_qty, reserved_qty) VALUES ($1, $2, $3, $4, $5)',
        [rows[0]!.id, 'warehouse', l.warehouseId, l.plannedQty, reserved]);
    }
    await ensureSteps(tx, eventId);
    await emit(tx, 'event.round_added', { recordType: 'event', recordId: eventId, actorUserId: auth.user.id,
      payload: { eventId, number: ev[0].number, name: ev[0].name, round, link: `/events/${eventId}`, recipientIds: await assigneeIds(tx, eventId) } });
    await writeAudit(tx, { action: 'event.round_added', actorUserId: auth.user.id, entityType: 'event', entityId: eventId, after: { round, lines }, ctx });
    return { round };
  });
}
