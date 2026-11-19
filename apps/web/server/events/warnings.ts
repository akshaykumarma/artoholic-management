import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { emit } from '../notifications/outbox';
import { now } from '../auth/clock';
import { windowAvailability, type Clash } from './availability';
import { everyoneInvolved } from './recipients';

type Tx = Pick<PoolClient, 'query'>;
const NIL = '00000000-0000-0000-0000-000000000000';

interface Need { itemId: string; warehouseId: string | null; sourceEventId: string | null; shortfall: Decimal; clashing: Clash[] }

/** Shortfalls of one Scheduled event against its window (005 FR-003a, FR-004). */
async function needsOf(tx: Tx, eventId: string): Promise<Need[]> {
  const { rows: ev } = await tx.query<{ status: string; leave_date: string | null; leave_at: Date | null; ret: string | null; scheduled_at: Date | null }>(
    `SELECT status, (leave_warehouse_at AT TIME ZONE 'Asia/Kolkata')::date::text AS leave_date, leave_warehouse_at AS leave_at, expected_return_date::text AS ret, scheduled_at FROM events WHERE id = $1`,
    [eventId]
  );
  const e = ev[0];
  if (!e || e.status !== 'scheduled' || !e.leave_date || !e.ret) return [];
  const { rows: src } = await tx.query<{ item_id: string; source_type: string; warehouse_id: string | null; source_event_id: string | null; q: string }>(
    `SELECT el.item_id, s.source_type, s.warehouse_id, s.source_event_id, sum(s.planned_qty)::text AS q
       FROM event_lines el JOIN event_line_sources s ON s.event_line_id = el.id WHERE el.event_id = $1 GROUP BY 1, 2, 3, 4`,
    [eventId]
  );
  const items = [...new Set(src.filter((s) => s.warehouse_id).map((s) => s.item_id))];
  const avail = await windowAvailability(tx, items, { start: e.leave_date, end: e.ret }, eventId, e.scheduled_at);
  const needs: Need[] = [];
  for (const s of src) {
    if (s.source_type === 'warehouse') {
      const cell = avail.get(s.item_id)?.find((c) => c.warehouseId === s.warehouse_id);
      const available = Decimal.max(cell?.available ?? 0, 0);
      const short = new Decimal(s.q).minus(available);
      needs.push({ itemId: s.item_id, warehouseId: s.warehouse_id, sourceEventId: null, shortfall: Decimal.max(short, 0), clashing: cell?.clashing ?? [] });
    } else {
      const { rows: x } = await tx.query<{ ok: boolean; planned: string | null; promised: string; number: string; name: string }>(
        `SELECT (x.status IN ('scheduled', 'dispatching', 'in_transit', 'at_site') AND x.ends_at IS NOT NULL AND x.ends_at <= $3) AS ok,
                x.number, x.name,
                (SELECT sum(planned_qty)::text FROM event_lines WHERE event_id = x.id AND item_id = $2) AS planned,
                COALESCE((SELECT sum(s2.planned_qty) FROM event_line_sources s2 JOIN event_lines l2 ON l2.id = s2.event_line_id JOIN events y ON y.id = l2.event_id
                           WHERE s2.source_event_id = x.id AND l2.item_id = $2 AND y.status NOT IN ('draft', 'cancelled')), 0)::text AS promised
           FROM events x WHERE x.id = $1`,
        [s.source_event_id, s.item_id, e.leave_at]
      );
      const r = x[0];
      let short = new Decimal(s.q);
      if (r?.ok && r.planned) short = Decimal.min(short, Decimal.max(new Decimal(r.promised).minus(r.planned), 0));
      needs.push({ itemId: s.item_id, warehouseId: null, sourceEventId: s.source_event_id, shortfall: short,
        clashing: r ? [{ id: s.source_event_id!, number: r.number, name: r.name }] : [] });
    }
  }
  return needs;
}

/**
 * Raises, updates and resolves over-booking warnings for the given events, telling the event's
 * Admins, Event Managers and Store Managers on raise and on resolve (005 US2, owner decision Q4).
 */
export async function evaluateWarnings(tx: Tx, eventIds: string[], actorUserId: string | null = null): Promise<void> {
  for (const eventId of [...new Set(eventIds)]) {
    const needs = await needsOf(tx, eventId);
    const { rows: active } = await tx.query<{ id: string; item_id: string; warehouse_id: string | null; source_event_id: string | null; shortfall_qty: string }>(
      'SELECT id, item_id, warehouse_id, source_event_id, shortfall_qty::text FROM overbooking_warnings WHERE event_id = $1 AND resolved_at IS NULL',
      [eventId]
    );
    const k = (i: string, w: string | null, s: string | null) => `${i}|${w ?? NIL}|${s ?? NIL}`;
    const seen = new Set<string>();
    let recipients: string[] | null = null;
    const who = async () => (recipients ??= await everyoneInvolved(tx, eventId));
    const { rows: evr } = await tx.query<{ number: string; name: string }>('SELECT number, name FROM events WHERE id = $1', [eventId]);
    const base = { eventId, number: evr[0]?.number, name: evr[0]?.name, link: `/events/${eventId}` };
    for (const n of needs) {
      if (n.shortfall.lte(0)) continue;
      const key = k(n.itemId, n.warehouseId, n.sourceEventId);
      seen.add(key);
      const existing = active.find((a) => k(a.item_id, a.warehouse_id, a.source_event_id) === key);
      const clashIds = n.clashing.map((c) => c.id);
      if (existing) {
        await tx.query('UPDATE overbooking_warnings SET shortfall_qty = $2, clashing_event_ids = $3 WHERE id = $1', [existing.id, n.shortfall.toFixed(3), clashIds]);
      } else {
        await tx.query(
          `INSERT INTO overbooking_warnings (event_id, item_id, warehouse_id, source_event_id, shortfall_qty, clashing_event_ids, raised_at, last_notified_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
          [eventId, n.itemId, n.warehouseId, n.sourceEventId, n.shortfall.toFixed(3), clashIds, now()]
        );
        await emit(tx, 'event.overbooking_raised', { recordType: 'event', recordId: eventId, actorUserId,
          payload: { ...base, itemId: n.itemId, warehouseId: n.warehouseId, sourceEventId: n.sourceEventId, shortfall: n.shortfall.toFixed(3), clashing: n.clashing, recipientIds: await who() } });
      }
    }
    for (const a of active) {
      if (seen.has(k(a.item_id, a.warehouse_id, a.source_event_id))) continue;
      await tx.query('UPDATE overbooking_warnings SET resolved_at = $2 WHERE id = $1', [a.id, now()]);
      await emit(tx, 'event.overbooking_resolved', { recordType: 'event', recordId: eventId, actorUserId,
        payload: { ...base, itemId: a.item_id, warehouseId: a.warehouse_id, sourceEventId: a.source_event_id, recipientIds: await who() } });
    }
  }
}

/** Events whose reservations or warnings may change when this event's items or plan change, first-scheduled first. */
export async function relatedEvents(tx: Tx, eventId: string, itemIds: string[]): Promise<string[]> {
  const { rows } = await tx.query<{ id: string }>(
    `SELECT e.id FROM events e WHERE e.id IN (
       SELECT el.event_id FROM event_lines el JOIN events x ON x.id = el.event_id
        WHERE x.status = 'scheduled' AND (el.item_id = ANY($2::uuid[])
          OR EXISTS (SELECT 1 FROM event_line_sources s WHERE s.event_line_id = el.id AND s.source_event_id = $1))
       UNION SELECT $1
       UNION SELECT event_id FROM overbooking_warnings WHERE resolved_at IS NULL AND (event_id = $1 OR source_event_id = $1 OR $1 = ANY(clashing_event_ids)))
     ORDER BY e.scheduled_at NULLS LAST, e.id`,
    [eventId, itemIds]
  );
  return rows.map((r) => r.id);
}
