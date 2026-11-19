import type { PoolClient } from 'pg';
import { getPool } from '../../../db/client';
import { logger } from '../../http/logger';

export const RESERVATION_CHECK_JOB = 'event-reservation-check';

/**
 * SC-005: reserved stock in the ledger equals what each event's warehouse sources say they hold,
 * no source holds more than it plans, and only Scheduled (or dispatching) events hold any.
 */
export async function reservationMismatches(db: Pick<PoolClient, 'query'>) {
  const { rows } = await db.query<{ event_id: string; item_id: string; ledger: string; sources: string; status: string }>(`
    WITH l AS (
      SELECT b.event_id, b.item_id, sum(b.quantity) AS q FROM stock_balances b WHERE b.condition = 'reserved' AND b.event_id IS NOT NULL GROUP BY 1, 2
    ), s AS (
      SELECT el.event_id, el.item_id, sum(src.reserved_qty) AS q, bool_or(src.reserved_qty > src.planned_qty) AS over
        FROM event_line_sources src JOIN event_lines el ON el.id = src.event_line_id GROUP BY 1, 2
    )
    SELECT COALESCE(l.event_id, s.event_id) AS event_id, COALESCE(l.item_id, s.item_id) AS item_id,
           COALESCE(l.q, 0)::text AS ledger, COALESCE(s.q, 0)::text AS sources, e.status
      FROM l FULL JOIN s ON s.event_id = l.event_id AND s.item_id = l.item_id
      JOIN events e ON e.id = COALESCE(l.event_id, s.event_id)
     WHERE (e.status IN ('draft', 'scheduled', 'cancelled') AND COALESCE(l.q, 0) <> COALESCE(s.q, 0))
        OR COALESCE(s.over, false)
        OR (e.status IN ('draft', 'cancelled', 'closed') AND COALESCE(l.q, 0) > 0)`);
  return rows;
}

export async function runReservationCheck(): Promise<number> {
  const rows = await reservationMismatches(getPool());
  if (rows.length) logger.error('event reservation mismatch', { count: rows.length, sample: rows.slice(0, 10) });
  return rows.length;
}
