import Decimal from 'decimal.js';
import { istDate, type AvailabilityResult, type EventRow } from '@artoholic/shared';
import { getPool } from '../../db/client';
import { now } from '../auth/clock';
import type { Authenticated } from '../auth/sessions';
import { VISIBLE } from './events';
import { suggestWarehouse, windowAvailability } from './availability';

const isAdmin = (auth: Authenticated) => auth.user.roles.includes('admin') || auth.user.roles.includes('super_admin');
const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

const ROW = `SELECT e.id, e.number, e.name, t.name AS type_name, e.status, e.venue_name, e.starts_at, e.ends_at, e.leave_warehouse_at,
  e.expected_return_date::text AS ret,
  EXISTS (SELECT 1 FROM overbooking_warnings o WHERE o.event_id = e.id AND o.resolved_at IS NULL) AS overbooked
  FROM events e LEFT JOIN event_types t ON t.id = e.type_id`;
type Row = { id: string; number: string; name: string; type_name: string | null; status: EventRow['status']; venue_name: string; starts_at: Date | null; ends_at: Date | null; leave_warehouse_at: Date | null; ret: string | null; overbooked: boolean };
const map = (r: Row): EventRow => ({
  id: r.id, number: r.number, name: r.name, typeName: r.type_name, status: r.status, venueName: r.venue_name, startsAt: iso(r.starts_at), endsAt: iso(r.ends_at),
  leaveWarehouseAt: iso(r.leave_warehouse_at), expectedReturnDate: r.ret, overbooked: r.overbooked
});

export interface EventQuery {
  status?: string; from?: string; to?: string; typeId?: string; managerId?: string; warehouseId?: string; overbooked?: boolean; q?: string; cursor?: number;
}

/** List with the US5 filters; managers see only their events (FR-010). */
export async function listEvents(auth: Authenticated, q: EventQuery): Promise<{ items: EventRow[]; nextCursor: string | null }> {
  const limit = 50;
  const offset = q.cursor ?? 0;
  const { rows } = await getPool().query<Row>(
    `${ROW}
     WHERE ($1::boolean OR ${VISIBLE('e.id', '$2')})
       AND ($3::event_status IS NULL OR e.status = $3)
       AND ($4::date IS NULL OR COALESCE(e.expected_return_date, (e.ends_at AT TIME ZONE 'Asia/Kolkata')::date) >= $4)
       AND ($5::date IS NULL OR (COALESCE(e.leave_warehouse_at, e.starts_at) AT TIME ZONE 'Asia/Kolkata')::date <= $5)
       AND ($6::uuid IS NULL OR e.type_id = $6)
       AND ($7::uuid IS NULL OR EXISTS (SELECT 1 FROM event_assignments a WHERE a.event_id = e.id AND a.user_id = $7 AND a.removed_at IS NULL))
       AND ($8::uuid IS NULL OR EXISTS (SELECT 1 FROM event_lines l JOIN event_line_sources s ON s.event_line_id = l.id WHERE l.event_id = e.id AND s.warehouse_id = $8))
       AND (NOT $9::boolean OR EXISTS (SELECT 1 FROM overbooking_warnings o WHERE o.event_id = e.id AND o.resolved_at IS NULL))
       AND ($10::text IS NULL OR e.name ILIKE '%' || $10 || '%' OR e.number ILIKE '%' || $10 || '%' OR e.venue_name ILIKE '%' || $10 || '%')
     ORDER BY e.starts_at NULLS LAST, e.number LIMIT ${limit + 1} OFFSET $11`,
    [isAdmin(auth), auth.user.id, q.status ?? null, q.from ?? null, q.to ?? null, q.typeId ?? null, q.managerId ?? null, q.warehouseId ?? null,
      q.overbooked ?? false, q.q?.trim() || null, offset]
  );
  return { items: rows.slice(0, limit).map(map), nextCursor: rows.length > limit ? String(offset + limit) : null };
}

/** Month view: events whose start–end dates touch the month (IST). */
export async function calendarMonth(auth: Authenticated, month: string): Promise<EventRow[]> {
  const first = `${month}-01`;
  const { rows } = await getPool().query<Row>(
    `${ROW}
     WHERE ($1::boolean OR ${VISIBLE('e.id', '$2')}) AND e.status <> 'cancelled' AND e.starts_at IS NOT NULL
       AND (e.starts_at AT TIME ZONE 'Asia/Kolkata')::date <= ($3::date + interval '1 month' - interval '1 day')::date
       AND (COALESCE(e.ends_at, e.starts_at) AT TIME ZONE 'Asia/Kolkata')::date >= $3::date
     ORDER BY e.starts_at, e.number`,
    [isAdmin(auth), auth.user.id, first]
  );
  return rows.map(map);
}

/** Dispatches and returns due today in IST (US5-1). */
export async function todayView(auth: Authenticated): Promise<{ date: string; dispatches: EventRow[]; returns: EventRow[] }> {
  const date = istDate(now());
  const scoped = `($1::boolean OR ${VISIBLE('e.id', '$2')})`;
  const pool = getPool();
  const d = await pool.query<Row>(
    `${ROW} WHERE ${scoped} AND e.status IN ('scheduled', 'dispatching') AND (e.leave_warehouse_at AT TIME ZONE 'Asia/Kolkata')::date = $3 ORDER BY e.leave_warehouse_at`,
    [isAdmin(auth), auth.user.id, date]
  );
  const r = await pool.query<Row>(
    `${ROW} WHERE ${scoped} AND e.status IN ('at_site', 'returning') AND e.expected_return_date = $3 ORDER BY e.number`,
    [isAdmin(auth), auth.user.id, date]
  );
  return { date, dispatches: d.rows.map(map), returns: r.rows.map(map) };
}

/** Live availability for the event form (US2-1, SC-002). */
export async function checkAvailability(input: {
  eventId?: string; leaveWarehouseAt: string; expectedReturnDate: string; lines: Array<{ itemId: string; qty: string; warehouseId?: string }>;
}): Promise<AvailabilityResult> {
  const cells = await windowAvailability(getPool(), [...new Set(input.lines.map((l) => l.itemId))],
    { start: istDate(input.leaveWarehouseAt), end: input.expectedReturnDate }, input.eventId);
  return {
    lines: input.lines.map((l) => {
      const all = cells.get(l.itemId) ?? [];
      const suggested = suggestWarehouse(all);
      const target = l.warehouseId ?? suggested;
      const cell = all.find((c) => c.warehouseId === target);
      const available = Decimal.max(cell?.available ?? 0, 0);
      return {
        itemId: l.itemId, warehouseId: target ?? null, available: available.toFixed(3), required: new Decimal(l.qty).toFixed(3),
        shortfall: Decimal.max(new Decimal(l.qty).minus(available), 0).toFixed(3), suggestedWarehouseId: suggested,
        byWarehouse: all.map((c) => ({ warehouseId: c.warehouseId, warehouseCode: c.warehouseCode, available: Decimal.max(c.available, 0).toFixed(3) })),
        clashingEvents: cell?.clashing ?? []
      };
    })
  };
}

/** Earlier events that can hand an item over directly (clarification, research R5). */
export async function handoverSources(itemId: string, leaveAt: string, excludeEventId?: string) {
  const { rows } = await getPool().query<{ id: string; number: string; name: string; ends_at: Date; planned: string; promised: string }>(
    `SELECT x.id, x.number, x.name, x.ends_at, sum(el.planned_qty)::text AS planned,
            COALESCE((SELECT sum(s2.planned_qty) FROM event_line_sources s2 JOIN event_lines l2 ON l2.id = s2.event_line_id JOIN events y ON y.id = l2.event_id
                       WHERE s2.source_event_id = x.id AND l2.item_id = $1 AND y.status NOT IN ('draft', 'cancelled') AND y.id IS DISTINCT FROM $3::uuid), 0)::text AS promised
       FROM events x JOIN event_lines el ON el.event_id = x.id AND el.item_id = $1
      WHERE x.status IN ('scheduled', 'dispatching', 'in_transit', 'at_site') AND x.ends_at IS NOT NULL AND x.ends_at <= $2 AND x.id IS DISTINCT FROM $3::uuid
      GROUP BY x.id ORDER BY x.ends_at DESC LIMIT 20`,
    [itemId, leaveAt, excludeEventId ?? null]
  );
  return rows
    .map((r) => ({ eventId: r.id, number: r.number, name: r.name, endsAt: new Date(r.ends_at).toISOString(), freeQty: Decimal.max(new Decimal(r.planned).minus(r.promised), 0).toFixed(3) }))
    .filter((r) => new Decimal(r.freeQty).gt(0));
}

export async function listEventTypes(includeArchived = false) {
  const { rows } = await getPool().query<{ id: string; name: string; status: 'active' | 'archived' }>(
    'SELECT id, name, status FROM event_types WHERE ($1::boolean OR status = \'active\') ORDER BY position, name', [includeArchived]
  );
  return rows;
}
