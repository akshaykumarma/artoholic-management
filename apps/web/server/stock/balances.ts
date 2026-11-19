import type { PoolClient } from 'pg';
import { getPool } from '../../db/client';

const NIL = '00000000-0000-0000-0000-000000000000';

/** Sum of a balance key (tests, checks). `locationId` null matches stock held at no location. */
export async function balanceOf(itemId: string, locationId: string | null, condition: string, pieceId?: string | null): Promise<string> {
  const { rows } = await getPool().query<{ q: string }>(
    `SELECT COALESCE(sum(quantity), 0)::numeric(14,3)::text AS q FROM stock_balances
      WHERE item_id = $1 AND COALESCE(location_id, '${NIL}') = COALESCE($2::uuid, '${NIL}') AND condition = $3
        AND ($4::uuid IS NULL OR piece_id = $4)`,
    [itemId, locationId, condition, pieceId ?? null]
  );
  return rows[0]!.q;
}

/**
 * Recomputes every balance from the ledger and returns any key where the cache differs
 * (003 SC-002). Run nightly; an empty array means the cache is exact.
 */
export async function rebuildMismatches(db: Pick<PoolClient, 'query'>): Promise<Array<{ key: string; cached: string; ledger: string }>> {
  const { rows } = await db.query<{ key: string; cached: string; ledger: string }>(`
    WITH sides AS (
      SELECT item_id, from_piece_id AS piece_id, from_location_id AS location_id, from_event_id AS event_id, from_transfer_id AS transfer_id, from_condition AS condition, -quantity AS q
        FROM stock_movements WHERE from_condition IS NOT NULL
      UNION ALL
      SELECT item_id, to_piece_id, to_location_id, to_event_id, to_transfer_id, to_condition, quantity
        FROM stock_movements WHERE to_condition IS NOT NULL
    ), ledger AS (
      SELECT item_id, piece_id, location_id, event_id, transfer_id, condition, sum(q) AS q FROM sides GROUP BY 1, 2, 3, 4, 5, 6
    )
    SELECT concat_ws('|', COALESCE(l.item_id, b.item_id), COALESCE(l.piece_id, b.piece_id), COALESCE(l.location_id, b.location_id),
                     COALESCE(l.event_id, b.event_id), COALESCE(l.condition, b.condition)) AS key,
           COALESCE(b.quantity, 0)::text AS cached, COALESCE(l.q, 0)::text AS ledger
      FROM ledger l FULL JOIN stock_balances b
        ON b.item_id = l.item_id AND b.condition = l.condition
       AND COALESCE(b.piece_id, '${NIL}') = COALESCE(l.piece_id, '${NIL}')
       AND COALESCE(b.location_id, '${NIL}') = COALESCE(l.location_id, '${NIL}')
       AND COALESCE(b.event_id, '${NIL}') = COALESCE(l.event_id, '${NIL}')
       AND COALESCE(b.transfer_id, '${NIL}') = COALESCE(l.transfer_id, '${NIL}')
     WHERE COALESCE(b.quantity, 0) <> COALESCE(l.q, 0)`);
  return rows;
}
