import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { ApiError } from '../http/errors';

type Tx = Pick<PoolClient, 'query'>;
export interface Slice { pieceId: string | null; locationId: string | null; qty: string }

/** Splits a quantity across an event's `out` balances for an item (pieces for cut products). */
export async function outSlices(tx: Tx, eventId: string, itemId: string, qty: string | Decimal, preferPieceId?: string | null): Promise<Slice[]> {
  let need = new Decimal(qty);
  if (need.lte(0)) return [];
  const { rows } = await tx.query<{ piece_id: string | null; q: string }>(
    `SELECT piece_id, quantity::text AS q FROM stock_balances
      WHERE event_id = $1 AND item_id = $2 AND condition = 'out' AND location_id IS NULL AND quantity > 0
      ORDER BY (piece_id IS NOT DISTINCT FROM $3::uuid) DESC, piece_id NULLS FIRST`,
    [eventId, itemId, preferPieceId ?? null]
  );
  const out: Slice[] = [];
  for (const r of rows) {
    if (need.lte(0)) break;
    const take = Decimal.min(need, r.q);
    out.push({ pieceId: r.piece_id, locationId: null, qty: take.toFixed(3) });
    need = need.minus(take);
  }
  if (need.gt(0)) throw new ApiError('INSUFFICIENT_STOCK', { itemId, eventId, short: need.toFixed(3) }, 'The event does not hold that much of this item.');
  return out;
}

/** Stock to dispatch from a warehouse: the event's reservation first, then free stock (pieces preferred). */
export async function dispatchSlices(tx: Tx, eventId: string, itemId: string, warehouseId: string, qty: string | Decimal, preferPieceId?: string | null) {
  let need = new Decimal(qty);
  const reserved: Slice[] = [];
  const free: Slice[] = [];
  const pick = async (condition: 'reserved' | 'available', into: Slice[]) => {
    const { rows } = await tx.query<{ location_id: string; piece_id: string | null; q: string }>(
      `SELECT b.location_id, b.piece_id, b.quantity::text AS q FROM stock_balances b JOIN locations l ON l.id = b.location_id
        WHERE b.item_id = $1 AND l.warehouse_id = $2 AND b.condition = $3 AND b.quantity > 0
          AND (($3 = 'reserved' AND b.event_id = $4) OR ($3 = 'available' AND b.event_id IS NULL AND b.transfer_id IS NULL))
        ORDER BY (b.piece_id IS NOT DISTINCT FROM $5::uuid) DESC, l.code, b.piece_id NULLS FIRST`,
      [itemId, warehouseId, condition, eventId, preferPieceId ?? null]
    );
    for (const r of rows) {
      if (need.lte(0)) break;
      const take = Decimal.min(need, r.q);
      into.push({ pieceId: r.piece_id, locationId: r.location_id, qty: take.toFixed(3) });
      need = need.minus(take);
    }
  };
  await pick('reserved', reserved);
  await pick('available', free);
  if (need.gt(0)) throw new ApiError('INSUFFICIENT_STOCK', { itemId, warehouseId, short: need.toFixed(3) }, 'Not enough stock in the warehouse for this dispatch.');
  return { reserved, free };
}

/** The bin an item usually lives in: the bin holding most of it, else the first bin, else the default location. */
export async function usualBin(tx: Tx, warehouseId: string, itemId: string): Promise<{ id: string; code: string } | null> {
  const { rows } = await tx.query<{ id: string; code: string }>(
    `WITH lv AS (SELECT count(*)::int AS n FROM warehouse_levels WHERE warehouse_id = $1)
     SELECT l.id, l.code FROM locations l, lv
      WHERE l.warehouse_id = $1 AND l.status = 'active' AND ((lv.n = 0 AND l.is_default) OR (lv.n > 0 AND NOT l.is_default AND l.level = lv.n))
      ORDER BY (SELECT COALESCE(sum(quantity), 0) FROM stock_balances b WHERE b.location_id = l.id AND b.item_id = $2) DESC, l.code LIMIT 1`,
    [warehouseId, itemId]
  );
  if (rows[0]) return rows[0];
  const d = await tx.query<{ id: string; code: string }>('SELECT id, code FROM locations WHERE warehouse_id = $1 AND is_default', [warehouseId]);
  return d.rows[0] ?? null;
}
