import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { isQuantity, toQty, type Condition, type MovementType } from '@artoholic/shared';
import { ApiError } from '../http/errors';
import { emit } from '../notifications/outbox';
import { now } from '../auth/clock';
import type { RequestContext } from '../http/context';

type Tx = Pick<PoolClient, 'query'>;
const NIL = '00000000-0000-0000-0000-000000000000';

export interface Side {
  locationId?: string | null;
  eventId?: string | null;
  condition: Condition;
}

export interface MovementInput {
  type: MovementType;
  itemId: string;
  quantity: string;
  from?: Side;
  to?: Side;
  /** Piece for both sides (cut products). */
  pieceId?: string | null;
  /** Cuts move length from one piece to another. */
  fromPieceId?: string | null;
  toPieceId?: string | null;
  reference?: { type: string; id: string };
  reason?: string | null;
  correctsMovementId?: number | null;
}

interface Key {
  itemId: string;
  pieceId: string | null;
  locationId: string | null;
  eventId: string | null;
  condition: Condition;
}

const keyString = (k: Key) => [k.itemId, k.pieceId ?? NIL, k.locationId ?? NIL, k.eventId ?? NIL, k.condition].join('|');

/**
 * The only writer of stock_movements and stock_balances (constitution II, research R1–R2).
 * Balance rows are locked in a fixed key order (no deadlocks); any result below zero is refused
 * with INSUFFICIENT_STOCK, rolling back the whole call.
 */
export async function postMovements(
  tx: Tx,
  movements: MovementInput[],
  meta: { actorUserId: string | null; ctx?: Pick<RequestContext, 'platform'> }
): Promise<number[]> {
  if (!movements.length) return [];
  const itemIds = [...new Set(movements.map((m) => m.itemId))];
  const { rows: items } = await tx.query<{ id: string; tracking_type: string; minimum_stock: string | null; name: string }>(
    'SELECT id, tracking_type, minimum_stock::text, name FROM items WHERE id = ANY($1::uuid[])',
    [itemIds]
  );
  const byId = new Map(items.map((i) => [i.id, i]));

  const deltas = new Map<string, { key: Key; delta: Decimal }>();
  const add = (key: Key, d: Decimal) => {
    const s = keyString(key);
    const cur = deltas.get(s);
    deltas.set(s, { key, delta: cur ? cur.delta.add(d) : d });
  };

  for (const m of movements) {
    const it = byId.get(m.itemId);
    if (!it) throw new ApiError('NOT_FOUND', { itemId: m.itemId });
    if (!isQuantity(m.quantity, { counted: it.tracking_type === 'counted' }) || new Decimal(m.quantity).lte(0)) {
      throw new ApiError('VALIDATION_FAILED', { fields: { quantity: it.tracking_type === 'counted' ? 'Whole numbers only' : 'Positive number, up to 3 decimals' } });
    }
    if (!m.from && !m.to) throw new Error('movement needs a from or to side');
    const qd = new Decimal(m.quantity);
    const fromPiece = m.fromPieceId ?? m.pieceId ?? null;
    const toPiece = m.toPieceId ?? m.pieceId ?? null;
    if (m.from) add({ itemId: m.itemId, pieceId: fromPiece, locationId: m.from.locationId ?? null, eventId: m.from.eventId ?? null, condition: m.from.condition }, qd.neg());
    if (m.to) add({ itemId: m.itemId, pieceId: toPiece, locationId: m.to.locationId ?? null, eventId: m.to.eventId ?? null, condition: m.to.condition }, qd);
  }

  const availableDelta = new Map<string, Decimal>();
  for (const s of [...deltas.keys()].sort()) {
    const { key, delta } = deltas.get(s)!;
    if (delta.isZero()) continue;
    await tx.query(
      `INSERT INTO stock_balances (item_id, piece_id, location_id, event_id, condition, quantity) VALUES ($1, $2, $3, $4, $5, 0)
       ON CONFLICT (item_id, COALESCE(piece_id, '${NIL}'), COALESCE(location_id, '${NIL}'), COALESCE(event_id, '${NIL}'), condition) DO NOTHING`,
      [key.itemId, key.pieceId, key.locationId, key.eventId, key.condition]
    );
    const { rows } = await tx.query<{ id: string; quantity: string }>(
      `SELECT id, quantity::text FROM stock_balances
        WHERE item_id = $1 AND COALESCE(piece_id, '${NIL}') = COALESCE($2::uuid, '${NIL}') AND COALESCE(location_id, '${NIL}') = COALESCE($3::uuid, '${NIL}')
          AND COALESCE(event_id, '${NIL}') = COALESCE($4::uuid, '${NIL}') AND condition = $5
        FOR UPDATE`,
      [key.itemId, key.pieceId, key.locationId, key.eventId, key.condition]
    );
    const row = rows[0]!;
    const next = new Decimal(row.quantity).add(delta);
    if (next.isNeg()) {
      throw new ApiError('INSUFFICIENT_STOCK', {
        itemId: key.itemId, itemName: byId.get(key.itemId)!.name, locationId: key.locationId, pieceId: key.pieceId,
        eventId: key.eventId, condition: key.condition, available: toQty(row.quantity)
      }, `Not enough stock: ${toQty(row.quantity)} ${key.condition} available.`);
    }
    await tx.query('UPDATE stock_balances SET quantity = $2 WHERE id = $1', [row.id, next.toFixed(3)]);
    if (key.condition === 'available') availableDelta.set(key.itemId, (availableDelta.get(key.itemId) ?? new Decimal(0)).add(delta));
  }

  const ids: number[] = [];
  const at = now();
  for (const m of movements) {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO stock_movements (type, item_id, from_piece_id, to_piece_id, quantity, from_location_id, from_event_id, from_condition,
         to_location_id, to_event_id, to_condition, reference_type, reference_id, corrects_movement_id, reason, actor_user_id, occurred_at, client_platform)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [
        m.type, m.itemId, m.from ? m.fromPieceId ?? m.pieceId ?? null : null, m.to ? m.toPieceId ?? m.pieceId ?? null : null, m.quantity,
        m.from?.locationId ?? null, m.from?.eventId ?? null, m.from?.condition ?? null,
        m.to?.locationId ?? null, m.to?.eventId ?? null, m.to?.condition ?? null,
        m.reference?.type ?? null, m.reference?.id ?? null, m.correctsMovementId ?? null, m.reason ?? null,
        meta.actorUserId, at, meta.ctx?.platform ?? null
      ]
    );
    ids.push(Number(rows[0]!.id));
  }

  // Low-stock alert once per downward crossing of the minimum (003 FR-011).
  for (const [itemId, d] of availableDelta) {
    const min = byId.get(itemId)!.minimum_stock;
    if (min === null || !d.isNeg()) continue;
    const { rows } = await tx.query<{ q: string }>("SELECT COALESCE(sum(quantity), 0)::text AS q FROM stock_balances WHERE item_id = $1 AND condition = 'available'", [itemId]);
    const after = new Decimal(rows[0]!.q);
    const before = after.sub(d);
    if (before.gte(min) && after.lt(min)) {
      await emit(tx, 'stock.low', { recordType: 'item', recordId: itemId, actorUserId: meta.actorUserId, payload: { itemId, available: after.toFixed(3), minimum: new Decimal(min).toFixed(3) } });
    }
  }
  return ids;
}
