import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';

type Tx = Pick<PoolClient, 'query'>;
export interface Clash { id: string; number: string; name: string }
export interface Cell { warehouseId: string; warehouseCode: string; available: Decimal; clashing: Clash[] }

const IST_DATE = (col: string) => `(${col} AT TIME ZONE 'Asia/Kolkata')::date`;

/**
 * Window availability per item and active warehouse (005 research R2):
 * stock in the warehouse's locations (available + reserved) minus what overlapping events have
 * committed there — planned quantities for Scheduled events, and still-reserved stock for events
 * already dispatching. Stock reserved for events outside the window counts as available.
 */
export async function windowAvailability(
  db: Tx,
  itemIds: string[],
  window: { start: string; end: string },
  excludeEventId?: string | null,
  /** Only count Scheduled events that were scheduled before this instant (priority to the first). */
  scheduledBefore?: Date | null
): Promise<Map<string, Cell[]>> {
  const out = new Map<string, Cell[]>();
  if (!itemIds.length) return out;
  const { rows: phys } = await db.query<{ item_id: string; warehouse_id: string; code: string; q: string }>(
    `SELECT i.item_id, w.id AS warehouse_id, w.code,
            COALESCE((SELECT sum(b.quantity) FROM stock_balances b JOIN locations l ON l.id = b.location_id
                       WHERE b.item_id = i.item_id AND l.warehouse_id = w.id AND b.condition IN ('available', 'reserved')), 0)::text AS q
       FROM warehouses w CROSS JOIN unnest($1::uuid[]) AS i(item_id)
      WHERE w.status = 'active' ORDER BY w.code`,
    [itemIds]
  );
  const { rows: com } = await db.query<{ item_id: string; warehouse_id: string; event_id: string; number: string; name: string; q: string }>(
    `WITH ov AS (
       SELECT e.id, e.number, e.name, e.status, e.scheduled_at FROM events e
        WHERE e.id IS DISTINCT FROM $4::uuid
          AND e.status IN ('scheduled', 'dispatching', 'in_transit', 'at_site', 'returning', 'reconciling')
          AND e.leave_warehouse_at IS NOT NULL AND e.expected_return_date IS NOT NULL
          AND ${IST_DATE('e.leave_warehouse_at')} <= $3::date AND $2::date <= e.expected_return_date
     )
     SELECT el.item_id, s.warehouse_id, ov.id AS event_id, ov.number, ov.name, s.planned_qty::text AS q
       FROM ov JOIN event_lines el ON el.event_id = ov.id
       JOIN event_line_sources s ON s.event_line_id = el.id AND s.source_type = 'warehouse'
      WHERE ov.status = 'scheduled' AND el.item_id = ANY($1::uuid[]) AND ($5::timestamptz IS NULL OR ov.scheduled_at < $5)
     UNION ALL
     SELECT b.item_id, l.warehouse_id, ov.id, ov.number, ov.name, b.quantity::text
       FROM stock_balances b JOIN locations l ON l.id = b.location_id JOIN ov ON ov.id = b.event_id
      WHERE ov.status <> 'scheduled' AND b.condition = 'reserved' AND b.quantity > 0 AND b.item_id = ANY($1::uuid[])`,
    [itemIds, window.start, window.end, excludeEventId ?? null, scheduledBefore ?? null]
  );
  for (const p of phys) {
    const mine = com.filter((c) => c.item_id === p.item_id && c.warehouse_id === p.warehouse_id);
    const committed = mine.reduce((s, c) => s.plus(c.q), new Decimal(0));
    const clashing = [...new Map(mine.map((c) => [c.event_id, { id: c.event_id, number: c.number, name: c.name }])).values()];
    const cells = out.get(p.item_id) ?? [];
    cells.push({ warehouseId: p.warehouse_id, warehouseCode: p.code, available: new Decimal(p.q).minus(committed), clashing });
    out.set(p.item_id, cells);
  }
  return out;
}

/** Warehouse with the most window availability for an item (005 US1-4). */
export function suggestWarehouse(cells: Cell[] | undefined): string | null {
  if (!cells?.length) return null;
  const best = [...cells].sort((a, b) => b.available.comparedTo(a.available))[0]!;
  return best.available.gt(0) ? best.warehouseId : null;
}
