import Decimal from 'decimal.js';
import { withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import { postMovements, type MovementInput } from '../stock/post';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';
import { homeWarehouse } from '../checklists/steps';
import { outSlices, usualBin } from '../checklists/stock';
import { lineTotals } from './closure';

/**
 * Correct a quantity on an event, closed or not (FR-010): a correction movement between the event's
 * `out` stock and where that field lives (bin, consumed, lost, damaged), referencing the original.
 * Nothing is overwritten; the activity log keeps old value, new value and reason.
 */
export async function correctEvent(auth: Authenticated, eventId: string, input: { lineSourceId: string; field: 'returned' | 'consumed' | 'lost' | 'damaged'; newValue: string; reason: string }, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    await tx.query('SELECT 1 FROM events WHERE id = $1 FOR UPDATE', [eventId]);
    const totals = (await lineTotals(tx, eventId)).find((t) => t.sourceId === input.lineSourceId);
    if (!totals) throw new ApiError('NOT_FOUND');
    const key = { returned: 'returned', consumed: 'consumed', lost: 'lostApproved', damaged: 'damagedApproved' }[input.field] as 'returned' | 'consumed' | 'lostApproved' | 'damagedApproved';
    const old = new Decimal(totals[key]);
    const delta = new Decimal(input.newValue).minus(old);
    if (delta.eq(0)) throw new ApiError('VALIDATION_FAILED', { fields: { newValue: 'That is the current value' } });
    const { rows } = await tx.query<{ item_id: string }>('SELECT el.item_id FROM event_line_sources s JOIN event_lines el ON el.id = s.event_line_id WHERE s.id = $1', [input.lineSourceId]);
    const itemId = rows[0]!.item_id;
    const home = await homeWarehouse(tx, input.lineSourceId);
    const bin = home ? await usualBin(tx, home, itemId) : null;
    const { rows: orig } = await tx.query<{ id: number }>(
      `SELECT m.id FROM stock_movements m WHERE m.item_id = $1 AND (m.from_event_id = $2 OR m.to_event_id = $2) ORDER BY m.id DESC LIMIT 1`, [itemId, eventId]
    );
    const target = {
      returned: { locationId: bin?.id ?? null, condition: 'available' as const },
      consumed: { condition: 'consumed' as const },
      lost: { condition: 'lost' as const },
      damaged: { locationId: bin?.id ?? null, condition: 'damaged' as const }
    }[input.field];
    const outSide = { eventId, condition: 'out' as const };
    const moves: MovementInput[] = [];
    if (delta.gt(0)) {
      for (const x of await outSlices(tx, eventId, itemId, delta)) {
        moves.push({ type: 'correction', itemId, pieceId: x.pieceId, quantity: x.qty, from: outSide, to: target, reason: input.reason, correctsMovementId: orig[0]?.id ?? null, reference: { type: 'event', id: eventId } });
      }
    } else {
      moves.push({ type: 'correction', itemId, quantity: delta.abs().toFixed(3), from: target, to: outSide, reason: input.reason, correctsMovementId: orig[0]?.id ?? null, reference: { type: 'event', id: eventId } });
    }
    const ids = await postMovements(tx, moves, { actorUserId: auth.user.id, ctx });
    await tx.query(
      `INSERT INTO event_corrections (event_id, event_line_source_id, field, old_value, new_value, reason, corrected_by, corrected_at, movement_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [eventId, input.lineSourceId, input.field, old.toFixed(3), input.newValue, input.reason, auth.user.id, now(), ids[0] ?? null]
    );
    await writeAudit(tx, { action: 'event.corrected', actorUserId: auth.user.id, entityType: 'event', entityId: eventId,
      before: { lineSourceId: input.lineSourceId, field: input.field, value: old.toFixed(3) },
      after: { lineSourceId: input.lineSourceId, field: input.field, value: new Decimal(input.newValue).toFixed(3), reason: input.reason }, ctx });
    return (await lineTotals(tx, eventId)).find((t) => t.sourceId === input.lineSourceId)!;
  });
}
