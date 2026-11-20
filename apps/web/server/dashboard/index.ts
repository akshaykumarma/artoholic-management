import type { Dashboard } from '@artoholic/shared';
import { istDate } from '@artoholic/shared';
import { getPool } from '../../db/client';
import { now } from '../auth/clock';

/** Admin home figures (009 US3), each backed by an indexed count; the screen polls every 60 s. */
export async function dashboard(): Promise<Dashboard> {
  const today = istDate(now());
  const { rows } = await getPool().query(
    `SELECT
       (SELECT count(*)::int FROM events WHERE status IN ('scheduled', 'dispatching') AND (leave_warehouse_at AT TIME ZONE 'Asia/Kolkata')::date = $1) AS d_today,
       (SELECT count(*)::int FROM events WHERE status IN ('in_transit', 'at_site', 'returning') AND expected_return_date = $1) AS r_today,
       (SELECT count(*)::int FROM events WHERE status IN ('scheduled', 'dispatching') AND (leave_warehouse_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1::date AND $1::date + 6) AS d_week,
       (SELECT count(*)::int FROM events WHERE status IN ('scheduled', 'dispatching', 'in_transit', 'at_site', 'returning') AND expected_return_date BETWEEN $1::date AND $1::date + 6) AS r_week,
       (SELECT COALESCE(json_object_agg(status, n), '{}') FROM (SELECT status, count(*)::int AS n FROM events GROUP BY status) x) AS by_status,
       (SELECT count(*)::int FROM damage_reports WHERE status = 'pending') AS p_damage,
       (SELECT count(*)::int FROM count_lines WHERE decision = 'pending') AS p_variance,
       (SELECT count(*)::int FROM correction_requests WHERE status = 'pending' AND kind = 'write_off') AS p_writeoff,
       (SELECT count(*)::int FROM correction_requests WHERE status = 'pending' AND kind = 'correction') AS p_correction,
       (SELECT count(*)::int FROM transfer_lines WHERE shortfall_decision = 'pending') AS p_shortfall,
       (SELECT COALESCE(sum(d.quantity * i.replacement_value_paise), 0)::bigint FROM damage_reports d JOIN event_line_sources s ON s.id = d.event_line_source_id
          JOIN event_lines l ON l.id = s.event_line_id JOIN items i ON i.id = l.item_id
         WHERE d.status = 'approved' AND d.kind = 'damaged' AND d.decided_at >= date_trunc('month', $1::date) - interval '330 minutes') AS damage_month,
       (SELECT count(*)::int FROM items i WHERE i.status = 'active' AND i.minimum_stock IS NOT NULL
          AND COALESCE((SELECT sum(b.quantity) FROM stock_balances b WHERE b.item_id = i.id AND b.condition = 'available'), 0) < i.minimum_stock) AS low_stock,
       (SELECT count(DISTINCT event_id)::int FROM overbooking_warnings WHERE resolved_at IS NULL) AS overbooked,
       (SELECT COALESCE(json_agg(json_build_object('name', name, 'dueDate', next_due_date::text) ORDER BY next_due_date), '[]')
          FROM (SELECT name, next_due_date FROM count_schedules WHERE status = 'active' ORDER BY next_due_date LIMIT 5) c) AS next_counts`,
    [today]
  );
  const r = rows[0];
  return {
    today: { dispatches: r.d_today, returns: r.r_today }, week: { dispatches: r.d_week, returns: r.r_week }, eventsByStatus: r.by_status,
    pendingApprovals: { damage: r.p_damage, variances: r.p_variance, writeOffs: r.p_writeoff, corrections: r.p_correction, transferShortfalls: r.p_shortfall },
    damageValueMonthPaise: Number(r.damage_month), lowStockCount: r.low_stock, overbookedCount: r.overbooked, nextCounts: r.next_counts
  };
}
