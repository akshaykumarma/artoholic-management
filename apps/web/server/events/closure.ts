import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { reconcile, type LineTotalsRow } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { emit } from '../notifications/outbox';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';
import { dispatchedFor } from '../checklists/steps';
import { assigneeIds } from './recipients';
import { requireEventAccess } from './events';

type Tx = Pick<PoolClient, 'query'>;

/** Running totals per line source (006 data-model), with corrections applied. */
export async function lineTotals(tx: Tx, eventId: string): Promise<LineTotalsRow[]> {
  const { rows } = await tx.query<{ id: string; item_name: string; label: string }>(
    `SELECT s.id, i.name AS item_name, COALESCE(w.code, x.number) AS label FROM event_line_sources s JOIN event_lines el ON el.id = s.event_line_id
       JOIN items i ON i.id = el.item_id LEFT JOIN warehouses w ON w.id = s.warehouse_id LEFT JOIN events x ON x.id = s.source_event_id
      WHERE el.event_id = $1 ORDER BY el.round, el.position, s.id`, [eventId]
  );
  const out: LineTotalsRow[] = [];
  for (const r of rows) {
    const sum = async (step: string, col: string) => new Decimal((await tx.query<{ q: string | null }>(
      `SELECT sum(e.${col})::text AS q FROM checklist_entries e JOIN checklist_steps st ON st.id = e.step_id
        WHERE e.event_line_source_id = $1 AND st.step = $2 AND st.status = 'submitted'`, [r.id, step])).rows[0]?.q ?? 0);
    const reports = async (kind: string) => new Decimal((await tx.query<{ q: string | null }>(
      "SELECT sum(quantity)::text AS q FROM damage_reports WHERE event_line_source_id = $1 AND kind = $2 AND status = 'approved'", [r.id, kind])).rows[0]?.q ?? 0);
    const corr = async (field: string) => new Decimal((await tx.query<{ q: string | null }>(
      'SELECT sum(new_value - old_value)::text AS q FROM event_corrections WHERE event_line_source_id = $1 AND field = $2', [r.id, field])).rows[0]?.q ?? 0);
    const t = {
      dispatched: (await dispatchedFor(tx, null, r.id)).toFixed(3),
      received: (await sum('site_receipt', 'qty_received')).toFixed(3),
      returned: (await sum('warehouse_receipt', 'qty_received')).plus(await corr('returned')).toFixed(3),
      handedOver: (await sum('return_dispatch', 'qty_handed_over')).toFixed(3),
      consumed: (await sum('return_dispatch', 'qty_consumed')).plus(await corr('consumed')).toFixed(3),
      damagedApproved: (await reports('damaged')).plus(await corr('damaged')).toFixed(3),
      lostApproved: (await reports('missing')).plus(await corr('lost')).toFixed(3)
    };
    const rc = reconcile(t);
    out.push({ sourceId: r.id, itemName: r.item_name, sourceLabel: r.label, ...t, outstanding: rc.outstanding, reconciled: rc.reconciled });
  }
  return out;
}

export async function getLineTotals(auth: Authenticated, eventId: string) {
  await requireEventAccess(auth, eventId);
  return lineTotals(getPool(), eventId);
}

/** Close only when every line is reconciled and every report decided (FR-008); closing locks the checklists. */
export async function closeEvent(auth: Authenticated, eventId: string, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const { rows: ev } = await tx.query<{ status: string; number: string; name: string }>('SELECT status, number, name FROM events WHERE id = $1 FOR UPDATE', [eventId]);
    if (!ev[0]) throw new ApiError('NOT_FOUND');
    if (['draft', 'scheduled', 'cancelled', 'closed'].includes(ev[0].status)) throw new ApiError('EVENT_STATE', { status: ev[0].status });
    const totals = await lineTotals(tx, eventId);
    const lines = totals.filter((l) => !l.reconciled).map((l) => ({ sourceId: l.sourceId, item: l.itemName, source: l.sourceLabel, outstanding: l.outstanding }));
    const { rows: reports } = await tx.query<{ id: string; number: string; status: string }>(
      "SELECT id, number, status FROM damage_reports WHERE event_id = $1 AND (status = 'pending' OR (status = 'rejected' AND resolved_by_recheck_at IS NULL)) ORDER BY number", [eventId]
    );
    const openSteps = (await tx.query("SELECT 1 FROM checklist_steps s JOIN dispatch_rounds r ON r.id = s.round_id WHERE r.event_id = $1 AND s.status <> 'submitted'", [eventId])).rowCount;
    if (lines.length || reports.length || openSteps) throw new ApiError('NOT_RECONCILED', { lines, reports, openSteps });
    await tx.query("UPDATE events SET status = 'closed', closed_by = $2, closed_at = $3, version = version + 1 WHERE id = $1", [eventId, auth.user.id, now()]);
    await emit(tx, 'event.closed', { recordType: 'event', recordId: eventId, actorUserId: auth.user.id,
      payload: { eventId, number: ev[0].number, name: ev[0].name, link: `/events/${eventId}`, recipientIds: await assigneeIds(tx, eventId) } });
    await writeAudit(tx, { action: 'event.closed', actorUserId: auth.user.id, entityType: 'event', entityId: eventId, ctx });
    return { status: 'closed' as const };
  });
}
