import Decimal from 'decimal.js';
import { istDate, lineTotalsSchema, type ReportFilters, type ReportId } from '@artoholic/shared';
import { getPool } from '../../db/client';
import { now } from '../auth/clock';
import { lineTotals } from '../events/closure';
import type { Scope } from './scope';

export type Row = Record<string, string | number | null>;
const q3 = (v: string | number | null | undefined) => (v === null || v === undefined ? null : new Decimal(v).toFixed(3));
const paise = (qty: string | number | null, rate: string | number | null) => new Decimal(qty ?? 0).mul(rate ?? 0).round().toNumber();
const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
const days = (n: number) => new Date(now().getTime() - n * 86_400_000);

type Q = (s: Scope, f: ReportFilters) => Promise<Row[]>;

/** R1 Stock on hand: per item, warehouse and bin; stock out at events listed under "At events". */
const R1: Q = async (s, f) => {
  const { rows } = await getPool().query(
    `SELECT i.name AS item, c.code, cat.name AS category, w.code AS warehouse, l.code AS bin,
            COALESCE(sum(b.quantity) FILTER (WHERE b.condition = 'available'), 0)::text AS available,
            COALESCE(sum(b.quantity) FILTER (WHERE b.condition = 'reserved'), 0)::text AS reserved,
            COALESCE(sum(b.quantity) FILTER (WHERE b.condition = 'damaged'), 0)::text AS damaged,
            '0' AS out, sum(b.quantity)::text AS total, i.replacement_value_paise::text AS rate
       FROM stock_balances b JOIN items i ON i.id = b.item_id JOIN item_codes c ON c.item_id = i.id AND c.active_to IS NULL
       JOIN categories cat ON cat.id = i.category_id JOIN locations l ON l.id = b.location_id JOIN warehouses w ON w.id = l.warehouse_id
      WHERE b.condition IN ('available', 'reserved', 'damaged') AND b.quantity > 0
        AND ($1::boolean OR w.id = ANY($2::uuid[])) AND ($3::uuid IS NULL OR w.id = $3) AND ($4::uuid IS NULL OR i.category_id = $4 OR cat.parent_id = $4)
      GROUP BY i.id, c.code, cat.name, w.code, l.code
     UNION ALL
     SELECT i.name, c.code, cat.name, 'At events', e.number, '0', '0', '0', sum(b.quantity)::text, sum(b.quantity)::text, i.replacement_value_paise::text
       FROM stock_balances b JOIN items i ON i.id = b.item_id JOIN item_codes c ON c.item_id = i.id AND c.active_to IS NULL
       JOIN categories cat ON cat.id = i.category_id JOIN events e ON e.id = b.event_id
      WHERE b.condition = 'out' AND b.quantity > 0 AND $3::uuid IS NULL
        AND ($1::boolean OR e.id = ANY($5::uuid[])) AND ($4::uuid IS NULL OR i.category_id = $4 OR cat.parent_id = $4)
      GROUP BY i.id, c.code, cat.name, e.number
      ORDER BY 1, 4, 5`,
    [s.all, s.warehouseIds, f.warehouseId ?? null, f.categoryId ?? null, s.eventIds]
  );
  return rows.map((r) => ({ item: r.item, code: r.code, category: r.category, warehouse: r.warehouse, bin: r.bin, available: q3(r.available), reserved: q3(r.reserved),
    out: q3(r.out), damaged: q3(r.damaged), value: paise(r.total, r.rate) }));
};

/** R2 Stock movement ledger. */
const R2: Q = async (s, f) => {
  const { rows } = await getPool().query(
    `SELECT m.occurred_at, i.name AS item, m.type, m.quantity::text AS quantity,
            COALESCE(fl.code, fe.number, m.from_condition::text, '') AS from_label, COALESCE(tl.code, te.number, m.to_condition::text, '') AS to_label,
            m.from_condition, m.to_condition, u.full_name AS user_name, COALESCE(m.reference_type || ' ' || m.reference_id, '') AS reference, COALESCE(m.reason, '') AS reason
       FROM stock_movements m JOIN items i ON i.id = m.item_id LEFT JOIN users u ON u.id = m.actor_user_id
       LEFT JOIN locations fl ON fl.id = m.from_location_id LEFT JOIN locations tl ON tl.id = m.to_location_id
       LEFT JOIN events fe ON fe.id = m.from_event_id LEFT JOIN events te ON te.id = m.to_event_id
      WHERE ($1::date IS NULL OR m.occurred_at >= ($1::date - interval '330 minutes')) AND ($2::date IS NULL OR m.occurred_at < ($2::date + 1 - interval '330 minutes'))
        AND ($3::uuid IS NULL OR fl.warehouse_id = $3 OR tl.warehouse_id = $3)
        AND ($4::boolean OR fl.warehouse_id = ANY($5::uuid[]) OR tl.warehouse_id = ANY($5::uuid[]))
      ORDER BY m.id DESC LIMIT 50000`,
    [f.from ?? null, f.to ?? null, f.warehouseId ?? null, s.all, s.warehouseIds]
  );
  const side = (label: string, cond: string | null) => (cond && label !== cond ? `${label} (${cond})` : label);
  return rows.map((r) => ({ at: iso(r.occurred_at), item: r.item, type: r.type, quantity: q3(r.quantity), from: side(r.from_label, r.from_condition),
    to: side(r.to_label, r.to_condition), user: r.user_name, reference: r.reference, reason: r.reason }));
};

const eventIdsIn = async (s: Scope, f: ReportFilters, statuses: string[]) => {
  const { rows } = await getPool().query<{ id: string }>(
    `SELECT e.id FROM events e WHERE e.status = ANY($1::event_status[]) AND ($2::boolean OR e.id = ANY($3::uuid[])) AND ($4::uuid IS NULL OR e.id = $4)
       AND ($5::date IS NULL OR (COALESCE(e.ends_at, e.starts_at) AT TIME ZONE 'Asia/Kolkata')::date >= $5)
       AND ($6::date IS NULL OR (e.starts_at AT TIME ZONE 'Asia/Kolkata')::date <= $6) ORDER BY e.starts_at, e.number LIMIT 500`,
    [statuses, s.all, s.eventIds, f.eventId ?? null, f.from ?? null, f.to ?? null]
  );
  return rows.map((r) => r.id);
};

/** R3 Event item status, from the same totals the closure gate uses. */
const R3: Q = async (s, f) => {
  const pool = getPool();
  const out: Row[] = [];
  for (const id of await eventIdsIn(s, f, ['scheduled', 'dispatching', 'in_transit', 'at_site', 'returning', 'reconciling', 'closed'])) {
    const { rows: ev } = await pool.query<{ number: string }>('SELECT number FROM events WHERE id = $1', [id]);
    const { rows: planned } = await pool.query<{ id: string; q: string }>('SELECT s.id, s.planned_qty::text AS q FROM event_line_sources s JOIN event_lines l ON l.id = s.event_line_id WHERE l.event_id = $1', [id]);
    for (const t of (await lineTotals(pool, id)).map((x) => lineTotalsSchema.parse(x))) {
      out.push({ event: ev[0]!.number, item: t.itemName, source: t.sourceLabel, planned: q3(planned.find((p) => p.id === t.sourceId)?.q ?? '0'), dispatched: t.dispatched,
        received: t.received, returned: t.returned, handedOver: t.handedOver, damaged: t.damagedApproved, lost: t.lostApproved, consumed: t.consumed, gap: t.outstanding });
    }
  }
  return out;
};

/** R4 Damage and loss, valued at replacement value. */
const R4: Q = async (s, f) => {
  const { rows } = await getPool().query(
    `SELECT d.reported_at, d.number, e.number AS event, i.name AS item, d.quantity::text AS q, d.kind, d.note, i.replacement_value_paise::text AS rate,
            u.full_name AS reporter, d.status, du.full_name AS decider
       FROM damage_reports d JOIN events e ON e.id = d.event_id JOIN event_line_sources s ON s.id = d.event_line_source_id JOIN event_lines l ON l.id = s.event_line_id
       JOIN items i ON i.id = l.item_id JOIN users u ON u.id = d.reported_by LEFT JOIN users du ON du.id = d.decided_by
      WHERE ($1::boolean OR e.id = ANY($2::uuid[])) AND ($3::uuid IS NULL OR e.id = $3)
        AND ($4::date IS NULL OR d.reported_at >= ($4::date - interval '330 minutes')) AND ($5::date IS NULL OR d.reported_at < ($5::date + 1 - interval '330 minutes'))
      ORDER BY d.reported_at DESC`,
    [s.all, s.eventIds, f.eventId ?? null, f.from ?? null, f.to ?? null]
  );
  return rows.map((r) => ({ at: iso(r.reported_at), number: r.number, event: r.event, item: r.item, quantity: q3(r.q), kind: r.kind, reason: r.note,
    value: paise(r.q, r.rate), reporter: r.reporter, decision: r.status, decidedBy: r.decider }));
};

/** R5 Pending approvals: damage, count variances, write-offs and corrections, transfer shortfalls. */
const R5: Q = async (s) => {
  const { rows } = await getPool().query(
    `SELECT 'Damage report' AS type, d.number, e.number AS context, i.name AS item, d.quantity::text AS q, d.reported_at AS since
       FROM damage_reports d JOIN events e ON e.id = d.event_id JOIN event_line_sources s ON s.id = d.event_line_source_id JOIN event_lines l ON l.id = s.event_line_id
       JOIN items i ON i.id = l.item_id WHERE d.status = 'pending' AND ($1::boolean OR e.id = ANY($2::uuid[]))
     UNION ALL
     SELECT 'Count variance', cs.number, cs.number, i.name, (cl.counted_qty - cl.recorded_qty)::text, cs.submitted_at
       FROM count_lines cl JOIN count_sessions cs ON cs.id = cl.session_id JOIN items i ON i.id = cl.item_id JOIN locations loc ON loc.id = cl.location_id
      WHERE cl.decision = 'pending' AND ($1::boolean OR loc.warehouse_id = ANY($3::uuid[]))
     UNION ALL
     SELECT CASE WHEN r.kind = 'write_off' THEN 'Write-off' ELSE 'Stock correction' END, '', COALESCE(loc.code, ''), i.name, r.quantity_change::text, r.requested_at
       FROM correction_requests r JOIN items i ON i.id = r.item_id LEFT JOIN locations loc ON loc.id = r.location_id
      WHERE r.status = 'pending' AND ($1::boolean OR loc.warehouse_id = ANY($3::uuid[]))
     UNION ALL
     SELECT 'Transfer shortfall', t.number, t.number, i.name, tl.missing_qty::text, t.received_at
       FROM transfer_lines tl JOIN transfers t ON t.id = tl.transfer_id JOIN items i ON i.id = tl.item_id
      WHERE tl.shortfall_decision = 'pending' AND ($1::boolean OR t.to_warehouse_id = ANY($3::uuid[]) OR t.from_warehouse_id = ANY($3::uuid[]))
     ORDER BY 6`,
    [s.all, s.eventIds, s.warehouseIds]
  );
  return rows.map((r) => ({ type: r.type, number: r.number, context: r.context, item: r.item, quantity: q3(r.q), since: iso(r.since) }));
};

/** R6 Upcoming dispatches and returns over the next 7 days (IST). */
const R6: Q = async (s, f) => {
  const today = istDate(now());
  const { rows } = await getPool().query(
    `WITH ev AS (
       SELECT e.*, (e.leave_warehouse_at AT TIME ZONE 'Asia/Kolkata')::date AS leave_date FROM events e
        WHERE e.status IN ('scheduled', 'dispatching', 'in_transit', 'at_site', 'returning') AND ($1::boolean OR e.id = ANY($2::uuid[]))
          AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM event_lines l JOIN event_line_sources s ON s.event_line_id = l.id WHERE l.event_id = e.id AND s.warehouse_id = $3)))
     SELECT x.date, x.kind, ev.number || ' · ' || ev.name AS event, ev.status, ev.id,
            (SELECT string_agg(DISTINCT w.code, ', ') FROM event_lines l JOIN event_line_sources s ON s.event_line_id = l.id JOIN warehouses w ON w.id = s.warehouse_id WHERE l.event_id = ev.id) AS warehouses,
            (SELECT count(*)::int FROM event_lines l WHERE l.event_id = ev.id) AS lines,
            (SELECT string_agg(u.full_name, ', ') FROM event_assignments a JOIN users u ON u.id = a.user_id WHERE a.event_id = ev.id AND a.removed_at IS NULL) AS managers,
            EXISTS (SELECT 1 FROM overbooking_warnings o WHERE o.event_id = ev.id AND o.resolved_at IS NULL) AS overbooked
       FROM ev CROSS JOIN LATERAL (VALUES (ev.leave_date, 'Dispatch'), (ev.expected_return_date, 'Return')) AS x(date, kind)
      WHERE x.date BETWEEN $4::date AND $4::date + 6 AND ((x.kind = 'Dispatch' AND ev.status IN ('scheduled', 'dispatching')) OR (x.kind = 'Return' AND ev.status IN ('in_transit', 'at_site', 'returning', 'scheduled', 'dispatching')))
      ORDER BY x.date, x.kind, ev.number`,
    [s.all, s.eventIds, f.warehouseId ?? null, today]
  );
  return rows.map((r) => ({ date: istDate(new Date(r.date)), kind: r.kind, event: r.event, warehouses: r.warehouses ?? '', lines: r.lines, managers: r.managers ?? '',
    status: r.status, overbooked: r.overbooked ? 'Yes' : '' }));
};

/** R7 Physical count variance. */
const R7: Q = async (s, f) => {
  const { rows } = await getPool().query(
    `SELECT cs.number, i.name AS item, loc.code AS bin, cl.recorded_qty::text AS recorded, cl.counted_qty::text AS counted, i.replacement_value_paise::text AS rate, COALESCE(cl.decision, '') AS decision
       FROM count_lines cl JOIN count_sessions cs ON cs.id = cl.session_id JOIN items i ON i.id = cl.item_id JOIN locations loc ON loc.id = cl.location_id
      WHERE cl.counted_qty IS NOT NULL AND ($1::boolean OR loc.warehouse_id = ANY($2::uuid[])) AND ($3::uuid IS NULL OR cs.id = $3) AND ($4::uuid IS NULL OR loc.warehouse_id = $4)
        AND ($5::date IS NULL OR cs.due_date >= $5) AND ($6::date IS NULL OR cs.due_date <= $6)
      ORDER BY cs.number, loc.code, i.name`,
    [s.all, s.warehouseIds, f.sessionId ?? null, f.warehouseId ?? null, f.from ?? null, f.to ?? null]
  );
  return rows.map((r) => {
    const v = new Decimal(r.counted).minus(r.recorded);
    return { session: r.number, item: r.item, bin: r.bin, recorded: q3(r.recorded), counted: q3(r.counted), variance: v.toFixed(3), value: paise(v.toString(), r.rate), decision: r.decision };
  });
};

/** R8 Item utilisation over the period (default: last 90 days). */
const R8: Q = async (s, f) => {
  const from = f.from ?? istDate(days(90));
  const to = f.to ?? istDate(now());
  const span = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1);
  const { rows } = await getPool().query(
    `WITH used AS (
       SELECT l.item_id, e.id AS event_id, GREATEST((e.leave_warehouse_at AT TIME ZONE 'Asia/Kolkata')::date, $1::date) AS d1,
              LEAST(COALESCE(e.expected_return_date, (e.ends_at AT TIME ZONE 'Asia/Kolkata')::date), $2::date) AS d2,
              (e.leave_warehouse_at AT TIME ZONE 'Asia/Kolkata')::date AS leave_date
         FROM event_lines l JOIN events e ON e.id = l.event_id
        WHERE e.status IN ('dispatching', 'in_transit', 'at_site', 'returning', 'reconciling', 'closed') AND e.leave_warehouse_at IS NOT NULL
          AND (e.leave_warehouse_at AT TIME ZONE 'Asia/Kolkata')::date <= $2::date AND COALESCE(e.expected_return_date, $2::date) >= $1::date
          AND ($3::boolean OR e.id = ANY($4::uuid[])))
     SELECT i.name AS item, c.code, count(DISTINCT u.event_id)::int AS events, COALESCE(sum(GREATEST(u.d2 - u.d1 + 1, 0)), 0)::int AS days_out,
            (SELECT max((e.leave_warehouse_at AT TIME ZONE 'Asia/Kolkata')::date) FROM event_lines l JOIN events e ON e.id = l.event_id
              WHERE l.item_id = i.id AND e.status NOT IN ('draft', 'cancelled', 'scheduled'))::text AS last_used
       FROM items i JOIN item_codes c ON c.item_id = i.id AND c.active_to IS NULL LEFT JOIN used u ON u.item_id = i.id
      WHERE i.status = 'active' AND ($5::uuid IS NULL OR i.category_id = $5 OR i.category_id IN (SELECT id FROM categories WHERE parent_id = $5))
      GROUP BY i.id, c.code ORDER BY days_out DESC, i.name`,
    [from, to, s.all, s.eventIds, f.categoryId ?? null]
  );
  return rows.map((r) => ({ item: r.item, code: r.code, events: r.events, daysOut: Math.min(r.days_out, span), idleDays: Math.max(0, span - r.days_out), lastUsed: r.last_used }));
};

/** R9 Low stock (below minimum) and dead stock (not used for 90 days). */
const R9: Q = async (s, f) => {
  const deadBefore = istDate(days(90));
  const { rows } = await getPool().query(
    `SELECT i.name AS item, c.code, i.minimum_stock::text AS minimum,
            COALESCE((SELECT sum(b.quantity) FROM stock_balances b JOIN locations l ON l.id = b.location_id
                       WHERE b.item_id = i.id AND b.condition = 'available' AND ($1::boolean OR l.warehouse_id = ANY($2::uuid[])) AND ($3::uuid IS NULL OR l.warehouse_id = $3)), 0)::text AS available,
            (SELECT max((e.leave_warehouse_at AT TIME ZONE 'Asia/Kolkata')::date) FROM event_lines el JOIN events e ON e.id = el.event_id
              WHERE el.item_id = i.id AND e.status NOT IN ('draft', 'cancelled', 'scheduled'))::text AS last_used
       FROM items i JOIN item_codes c ON c.item_id = i.id AND c.active_to IS NULL
      WHERE i.status = 'active' AND ($4::uuid IS NULL OR i.category_id = $4 OR i.category_id IN (SELECT id FROM categories WHERE parent_id = $4))
      ORDER BY i.name`,
    [s.all, s.warehouseIds, f.warehouseId ?? null, f.categoryId ?? null]
  );
  return rows.flatMap((r) => {
    const low = r.minimum !== null && new Decimal(r.available).lt(r.minimum);
    const dead = new Decimal(r.available).gt(0) && (!r.last_used || r.last_used < deadBefore);
    if (!low && !dead) return [];
    return [{ item: r.item, code: r.code, available: q3(r.available), minimum: q3(r.minimum), lastUsed: r.last_used, status: [low ? 'Low' : '', dead ? 'Dead' : ''].filter(Boolean).join(', ') }];
  });
};

/** R10 User activity from the audit log; managers see only themselves. */
const R10: Q = async (s, f) => {
  const { rows } = await getPool().query(
    `SELECT u.id, u.full_name,
            (SELECT count(*)::int FROM audit_entries a WHERE a.actor_user_id = u.id AND ($1::date IS NULL OR a.occurred_at >= $1::date - interval '330 minutes') AND ($2::date IS NULL OR a.occurred_at < $2::date + 1 - interval '330 minutes')) AS actions,
            (SELECT string_agg(x.k || ' ' || x.n, ', ' ORDER BY x.n DESC) FROM (SELECT split_part(a.action, '.', 1) AS k, count(*) AS n FROM audit_entries a
               WHERE a.actor_user_id = u.id AND ($1::date IS NULL OR a.occurred_at >= $1::date - interval '330 minutes') AND ($2::date IS NULL OR a.occurred_at < $2::date + 1 - interval '330 minutes') GROUP BY 1) x) AS by_type,
            (SELECT count(DISTINCT a.entity_id)::int FROM audit_entries a WHERE a.actor_user_id = u.id AND a.entity_type = 'event' AND ($1::date IS NULL OR a.occurred_at >= $1::date - interval '330 minutes') AND ($2::date IS NULL OR a.occurred_at < $2::date + 1 - interval '330 minutes')) AS events,
            (SELECT count(*)::int FROM audit_entries a WHERE a.actor_user_id = u.id AND (a.action LIKE '%approved%' OR a.action LIKE '%rejected%' OR a.action LIKE '%decided%') AND ($1::date IS NULL OR a.occurred_at >= $1::date - interval '330 minutes') AND ($2::date IS NULL OR a.occurred_at < $2::date + 1 - interval '330 minutes')) AS approvals,
            (SELECT max(se.created_at) FROM sessions se WHERE se.user_id = u.id) AS last_sign_in
       FROM users u WHERE ($3::boolean OR u.id = $4) AND ($5::uuid IS NULL OR u.id = $5) ORDER BY u.full_name`,
    [f.from ?? null, f.to ?? null, s.all, s.userId, f.userId ?? null]
  );
  return rows.map((r) => ({ user: r.full_name, actions: r.actions, byType: r.by_type ?? '', events: r.events, approvals: r.approvals, lastSignIn: iso(r.last_sign_in) }));
};

export const QUERIES: Record<ReportId, Q> = { R1, R2, R3, R4, R5, R6, R7, R8, R9, R10 };
