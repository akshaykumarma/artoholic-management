import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { postMovements, type MovementInput } from '../stock/post';
import type { RequestContext } from '../http/context';

type Tx = Pick<PoolClient, 'query'>;

/**
 * Brings an event's reservations in line with its plan (005 research R3): a Scheduled event
 * reserves its warehouse-sourced quantities (available → reserved, same bin, tagged with the
 * event); anything else holds nothing. If the shelf is short, it reserves what exists; later runs
 * top it up as stock arrives. Direct-handover sources never reserve (they stay on the source event).
 */
export async function syncReservations(tx: Tx, eventId: string, actorUserId: string | null, ctx?: Pick<RequestContext, 'platform'>): Promise<void> {
  const { rows: ev } = await tx.query<{ status: string }>('SELECT status FROM events WHERE id = $1', [eventId]);
  const holds = ev[0]?.status === 'scheduled';
  if (ev[0] && !['draft', 'scheduled', 'cancelled'].includes(ev[0].status)) return; // 006 owns stock from dispatch on
  const { rows: targets } = await tx.query<{ item_id: string; warehouse_id: string; q: string }>(
    `SELECT el.item_id, s.warehouse_id, sum(s.planned_qty)::text AS q
       FROM event_lines el JOIN event_line_sources s ON s.event_line_id = el.id AND s.source_type = 'warehouse'
      WHERE el.event_id = $1 GROUP BY 1, 2`,
    [eventId]
  );
  const { rows: held } = await tx.query<{ item_id: string; warehouse_id: string; location_id: string; piece_id: string | null; q: string }>(
    `SELECT b.item_id, l.warehouse_id, b.location_id, b.piece_id, b.quantity::text AS q
       FROM stock_balances b JOIN locations l ON l.id = b.location_id
      WHERE b.event_id = $1 AND b.condition = 'reserved' AND b.quantity > 0 ORDER BY l.code DESC`,
    [eventId]
  );
  const key = (i: string, w: string) => `${i}|${w}`;
  const want = new Map(targets.map((t) => [key(t.item_id, t.warehouse_id), holds ? new Decimal(t.q) : new Decimal(0)]));
  for (const h of held) if (!want.has(key(h.item_id, h.warehouse_id))) want.set(key(h.item_id, h.warehouse_id), new Decimal(0));
  const moves: MovementInput[] = [];
  for (const [k, target] of want) {
    const [itemId, warehouseId] = k.split('|') as [string, string];
    const mine = held.filter((h) => h.item_id === itemId && h.warehouse_id === warehouseId);
    const current = mine.reduce((s, h) => s.plus(h.q), new Decimal(0));
    if (target.lt(current)) {
      let release = current.minus(target);
      for (const h of mine) {
        if (release.lte(0)) break;
        const take = Decimal.min(release, h.q);
        moves.push({ type: 'release', itemId, pieceId: h.piece_id, quantity: take.toFixed(3),
          from: { locationId: h.location_id, eventId, condition: 'reserved' }, to: { locationId: h.location_id, condition: 'available' },
          reference: { type: 'event', id: eventId } });
        release = release.minus(take);
      }
    } else if (target.gt(current)) {
      let need = target.minus(current);
      const { rows: free } = await tx.query<{ location_id: string; piece_id: string | null; q: string }>(
        `SELECT b.location_id, b.piece_id, b.quantity::text AS q FROM stock_balances b JOIN locations l ON l.id = b.location_id
          WHERE b.item_id = $1 AND l.warehouse_id = $2 AND b.condition = 'available' AND b.event_id IS NULL AND b.transfer_id IS NULL AND b.quantity > 0
          ORDER BY l.code, b.piece_id NULLS FIRST`,
        [itemId, warehouseId]
      );
      for (const f of free) {
        if (need.lte(0)) break;
        const take = Decimal.min(need, f.q);
        moves.push({ type: 'reserve', itemId, pieceId: f.piece_id, quantity: take.toFixed(3),
          from: { locationId: f.location_id, condition: 'available' }, to: { locationId: f.location_id, eventId, condition: 'reserved' },
          reference: { type: 'event', id: eventId } });
        need = need.minus(take);
      }
    }
  }
  await postMovements(tx, moves, { actorUserId, ctx });
  // Spread what is now held across the event's warehouse sources, in line order.
  const { rows: now } = await tx.query<{ item_id: string; warehouse_id: string; q: string }>(
    `SELECT b.item_id, l.warehouse_id, sum(b.quantity)::text AS q FROM stock_balances b JOIN locations l ON l.id = b.location_id
      WHERE b.event_id = $1 AND b.condition = 'reserved' GROUP BY 1, 2`,
    [eventId]
  );
  const pool = new Map(now.map((n) => [key(n.item_id, n.warehouse_id), new Decimal(n.q)]));
  const { rows: sources } = await tx.query<{ id: string; item_id: string; warehouse_id: string | null; planned_qty: string }>(
    `SELECT s.id, el.item_id, s.warehouse_id, s.planned_qty::text FROM event_line_sources s JOIN event_lines el ON el.id = s.event_line_id
      WHERE el.event_id = $1 ORDER BY el.position, s.id`,
    [eventId]
  );
  for (const s of sources) {
    let r = new Decimal(0);
    if (s.warehouse_id) {
      const k = key(s.item_id, s.warehouse_id);
      const left = pool.get(k) ?? new Decimal(0);
      r = Decimal.min(left, s.planned_qty);
      pool.set(k, left.minus(r));
    }
    await tx.query('UPDATE event_line_sources SET reserved_qty = $2 WHERE id = $1', [s.id, r.toFixed(3)]);
  }
}
