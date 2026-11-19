import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import type { CountLine, CountReview, CountSheet } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { emit } from '../notifications/outbox';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import { postMovements } from '../stock/post';
import { adminIds } from '../events/recipients';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';

type Tx = Pick<PoolClient, 'query'>;
const isAdmin = (auth: Authenticated) => auth.user.roles.includes('admin') || auth.user.roles.includes('super_admin');
const q3 = (v: string | null) => (v === null ? null : new Decimal(v).toFixed(3));

async function session(tx: Tx, id: string) {
  const { rows } = await tx.query<{ id: string; number: string; due: string; blind: boolean; status: CountSheet['status']; scope: { warehouseIds: string[] }; submitted_at: Date | null; submitter: string | null }>(
    `SELECT s.id, s.number, s.due_date::text AS due, s.blind, s.status, s.scope, s.submitted_at, u.full_name AS submitter
       FROM count_sessions s LEFT JOIN users u ON u.id = s.submitted_by WHERE s.id = $1`, [id]
  );
  if (!rows[0]) throw new ApiError('NOT_FOUND');
  return rows[0];
}

async function isAssigned(tx: Tx, auth: Authenticated, sessionId: string) {
  return !!(await tx.query('SELECT 1 FROM count_session_assignees WHERE session_id = $1 AND user_id = $2', [sessionId, auth.user.id])).rowCount;
}

async function requireCounter(tx: Tx, auth: Authenticated, sessionId: string) {
  if (isAdmin(auth)) return;
  if (!auth.user.roles.includes('store_manager') || !(await isAssigned(tx, auth, sessionId))) throw new ApiError('FORBIDDEN');
}

type LineRow = {
  id: string; item_id: string; code: string; name: string; unit_code: string | null; replacement_value_paise: string; piece_id: string | null; piece_number: string | null;
  location_id: string; location_code: string; condition: CountLine['condition']; recorded_qty: string; counted_qty: string | null; note: string; photo_key: string | null;
  counter: string | null; added_by_counter: boolean; decision: CountLine['decision']; decision_reason: string | null; decider: string | null; event_movement: boolean;
};

async function lines(tx: Tx, sessionId: string): Promise<LineRow[]> {
  const { rows } = await tx.query<LineRow>(
    `SELECT l.id, l.item_id, c.code, i.name, i.unit_code, i.replacement_value_paise::text, l.piece_id, p.piece_number, l.location_id, loc.code AS location_code,
            l.condition, l.recorded_qty::text, l.counted_qty::text, l.note, l.photo_key, cu.full_name AS counter, l.added_by_counter, l.decision, l.decision_reason,
            du.full_name AS decider,
            EXISTS (SELECT 1 FROM event_lines el JOIN events e ON e.id = el.event_id
                     WHERE el.item_id = l.item_id AND e.status IN ('dispatching', 'returning', 'reconciling')) AS event_movement
       FROM count_lines l JOIN items i ON i.id = l.item_id JOIN item_codes c ON c.item_id = i.id AND c.active_to IS NULL
       JOIN locations loc ON loc.id = l.location_id LEFT JOIN item_pieces p ON p.id = l.piece_id
       LEFT JOIN users cu ON cu.id = l.counted_by LEFT JOIN users du ON du.id = l.decided_by
      WHERE l.session_id = $1 ORDER BY loc.code, i.name, p.piece_number NULLS FIRST, l.condition`,
    [sessionId]
  );
  return rows;
}

const toLine = (r: LineRow, showRecorded: boolean): CountLine => ({
  id: r.id, itemId: r.item_id, itemCode: r.code, itemName: r.name, unitCode: r.unit_code, pieceId: r.piece_id, pieceNumber: r.piece_number,
  locationId: r.location_id, locationCode: r.location_code, condition: r.condition, ...(showRecorded ? { recordedQty: q3(r.recorded_qty)! } : {}),
  countedQty: q3(r.counted_qty), note: r.note, photoKey: r.photo_key, countedBy: r.counter, addedByCounter: r.added_by_counter,
  eventMovement: r.event_movement, decision: r.decision
});

/** The count sheet in walking (bin code) order; blind counts never show recorded quantities to counters (US3-1). */
export async function getSheet(auth: Authenticated, sessionId: string): Promise<CountSheet> {
  const pool = getPool();
  const s = await session(pool, sessionId);
  const admin = isAdmin(auth);
  const assigned = await isAssigned(pool, auth, sessionId);
  if (!admin && !assigned) throw new ApiError('FORBIDDEN');
  const showRecorded = !s.blind || admin;
  const { rows: locs } = await pool.query<{ id: string; code: string }>(
    `SELECT l.id, l.code FROM locations l WHERE l.status = 'active' AND (cardinality($1::uuid[]) = 0 OR l.warehouse_id = ANY($1::uuid[]))
       AND (l.is_default OR l.level = (SELECT count(*) FROM warehouse_levels wl WHERE wl.warehouse_id = l.warehouse_id)) ORDER BY l.code LIMIT 3000`,
    [s.scope.warehouseIds ?? []]
  );
  const rows = await lines(pool, sessionId);
  return {
    id: s.id, number: s.number, dueDate: s.due, blind: s.blind, status: s.status,
    canCount: s.status === 'open' && (admin || (assigned && auth.user.roles.includes('store_manager'))),
    locations: locs, lines: rows.map((r) => toLine(r, showRecorded))
  };
}

/** Save and resume (US3); a line can be added for an item found where the record has none (US3-2). Latest write wins (R5). */
export async function saveEntries(auth: Authenticated, sessionId: string, entries: Array<{ lineId?: string; itemId?: string; pieceId?: string | null; locationId?: string; countedQty: string | null; note?: string; photoKey?: string | null }>, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    await requireCounter(tx, auth, sessionId);
    const s = await session(tx, sessionId);
    if (s.status !== 'open') throw new ApiError('SESSION_STATE', { status: s.status });
    let added = 0;
    for (const e of entries) {
      let lineId = e.lineId;
      if (!lineId) {
        if (!e.itemId || !e.locationId) throw new ApiError('VALIDATION_FAILED', { fields: { itemId: 'Choose the item and the bin' } });
        const { rows } = await tx.query<{ id: string }>(
          `INSERT INTO count_lines (session_id, item_id, piece_id, location_id, condition, recorded_qty, added_by_counter) VALUES ($1, $2, $3, $4, 'available', 0, true)
           ON CONFLICT (session_id, item_id, COALESCE(piece_id, '00000000-0000-0000-0000-000000000000'), location_id, condition) DO UPDATE SET session_id = EXCLUDED.session_id RETURNING id`,
          [sessionId, e.itemId, e.pieceId ?? null, e.locationId]
        );
        lineId = rows[0]!.id;
        added++;
      }
      const r = await tx.query(
        `UPDATE count_lines SET counted_qty = $3, note = COALESCE($4, note), photo_key = COALESCE($5, photo_key), counted_by = $6, counted_at = $7
          WHERE id = $1 AND session_id = $2 AND (decision IS NULL OR decision = 'recount')`,
        [lineId, sessionId, e.countedQty, e.note ?? null, e.photoKey ?? null, auth.user.id, now()]
      );
      if (!r.rowCount) throw new ApiError('VALIDATION_FAILED', { fields: { lineId: 'That line is not open for counting' } });
    }
    await writeAudit(tx, { action: 'count.entries_saved', actorUserId: auth.user.id, entityType: 'count_session', entityId: sessionId, after: { entries: entries.length, added }, ctx });
    return { saved: entries.length, added };
  });
}

/** Submit: uncounted lines need confirming as zero (US3-4); zero variances are matched, the rest wait for an Admin. */
export async function submitCount(auth: Authenticated, sessionId: string, confirmZero: boolean, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    await requireCounter(tx, auth, sessionId);
    await tx.query('SELECT 1 FROM count_sessions WHERE id = $1 FOR UPDATE', [sessionId]);
    const s = await session(tx, sessionId);
    if (s.status !== 'open') throw new ApiError('SESSION_STATE', { status: s.status });
    const { rows: open } = await tx.query<{ id: string }>("SELECT id FROM count_lines WHERE session_id = $1 AND counted_qty IS NULL AND (decision IS NULL OR decision = 'recount')", [sessionId]);
    if (open.length && !confirmZero) throw new ApiError('UNCOUNTED_LINES', { count: open.length });
    await tx.query("UPDATE count_lines SET counted_qty = 0, counted_by = $2, counted_at = $3 WHERE session_id = $1 AND counted_qty IS NULL AND (decision IS NULL OR decision = 'recount')", [sessionId, auth.user.id, now()]);
    await tx.query(
      `UPDATE count_lines SET decision = CASE WHEN counted_qty = recorded_qty THEN 'matched' ELSE 'pending' END
        WHERE session_id = $1 AND (decision IS NULL OR decision = 'recount')`, [sessionId]
    );
    const done = await maybeComplete(tx, sessionId);
    if (!done) await tx.query("UPDATE count_sessions SET status = 'submitted', submitted_by = $2, submitted_at = $3 WHERE id = $1", [sessionId, auth.user.id, now()]);
    else await tx.query('UPDATE count_sessions SET submitted_by = $2, submitted_at = COALESCE(submitted_at, $3) WHERE id = $1', [sessionId, auth.user.id, now()]);
    await emit(tx, 'count.submitted', { recordType: 'count_session', recordId: sessionId, actorUserId: auth.user.id,
      payload: { sessionId, number: s.number, link: `/counts/${sessionId}/review`, recipientIds: await adminIds(tx) } });
    await writeAudit(tx, { action: 'count.submitted', actorUserId: auth.user.id, entityType: 'count_session', entityId: sessionId, after: { confirmedZero: open.length }, ctx });
    return { status: done ? 'completed' : 'submitted' };
  });
}

async function maybeComplete(tx: Tx, sessionId: string): Promise<boolean> {
  const { rows } = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM count_lines WHERE session_id = $1 AND (decision IS NULL OR decision IN ('pending', 'recount'))", [sessionId]);
  if (rows[0]!.n > 0) return false;
  await tx.query("UPDATE count_sessions SET status = 'completed', completed_at = $2 WHERE id = $1", [sessionId, now()]);
  const { rows: s } = await tx.query<{ number: string }>('SELECT number FROM count_sessions WHERE id = $1', [sessionId]);
  await emit(tx, 'count.completed', { recordType: 'count_session', recordId: sessionId, payload: { sessionId, number: s[0]!.number, link: `/counts/${sessionId}/review`, recipientIds: await adminIds(tx) } });
  return true;
}

/** Admin review: variance in quantity and ₹ (at replacement value), biggest ₹ impact first (US4). */
export async function getReview(auth: Authenticated, sessionId: string): Promise<CountReview> {
  void auth;
  const pool = getPool();
  const s = await session(pool, sessionId);
  const rows = await lines(pool, sessionId);
  const mapped = rows.map((r) => {
    const variance = r.counted_qty === null ? new Decimal(0) : new Decimal(r.counted_qty).minus(r.recorded_qty);
    return { ...toLine(r, true), recordedQty: q3(r.recorded_qty)!, varianceQty: variance.toFixed(3),
      variancePaise: variance.mul(r.replacement_value_paise).round().toNumber(), decisionReason: r.decision_reason, decidedBy: r.decider };
  });
  mapped.sort((a, b) => Math.abs(b.variancePaise) - Math.abs(a.variancePaise) || a.locationCode.localeCompare(b.locationCode));
  return {
    id: s.id, number: s.number, status: s.status, submittedBy: s.submitter, submittedAt: s.submitted_at ? new Date(s.submitted_at).toISOString() : null,
    totalVariancePaise: mapped.reduce((t, l) => t + l.variancePaise, 0), lines: mapped
  };
}

/**
 * Approve: adjustment = counted − recorded at the snapshot, applied to today's balance, so stock that
 * moved after counting is not counted twice (US4-2, research R3). Going below zero → recount.
 */
export async function decideLine(auth: Authenticated, lineId: string, decision: 'approve' | 'reject', reason: string, ctx: RequestContext) {
  const result = await withTransaction(async (tx) => {
    const { rows } = await tx.query<{ session_id: string; item_id: string; piece_id: string | null; location_id: string; condition: 'available' | 'reserved' | 'damaged'; recorded: string; counted: string | null; decision: string | null; status: string; number: string }>(
      `SELECT l.session_id, l.item_id, l.piece_id, l.location_id, l.condition, l.recorded_qty::text AS recorded, l.counted_qty::text AS counted, l.decision, s.status, s.number
         FROM count_lines l JOIN count_sessions s ON s.id = l.session_id WHERE l.id = $1 FOR UPDATE OF l`, [lineId]
    );
    const l = rows[0];
    if (!l) throw new ApiError('NOT_FOUND');
    if (l.decision !== 'pending' || !['submitted', 'in_review'].includes(l.status)) throw new ApiError('SESSION_STATE', { decision: l.decision, status: l.status });
    await tx.query("UPDATE count_sessions SET status = 'in_review' WHERE id = $1 AND status = 'submitted'", [l.session_id]);
    if (decision === 'reject') {
      await tx.query("UPDATE count_lines SET decision = 'recount', decision_reason = $2, decided_by = $3, decided_at = $4, counted_qty = NULL, recounts = recounts + 1 WHERE id = $1",
        [lineId, reason, auth.user.id, now()]);
      await tx.query("UPDATE count_sessions SET status = 'open' WHERE id = $1", [l.session_id]);
      const { rows: people } = await tx.query<{ user_id: string }>('SELECT user_id FROM count_session_assignees WHERE session_id = $1', [l.session_id]);
      await emit(tx, 'count.recount', { recordType: 'count_session', recordId: l.session_id, actorUserId: auth.user.id,
        payload: { sessionId: l.session_id, number: l.number, reason, link: `/counts/${l.session_id}`, recipientIds: people.map((p) => p.user_id) } });
      await writeAudit(tx, { action: 'count.line_rejected', actorUserId: auth.user.id, entityType: 'count_session', entityId: l.session_id, after: { lineId, reason }, ctx });
      return { negative: false };
    }
    const adj = new Decimal(l.counted!).minus(l.recorded);
    const bin = { locationId: l.location_id, condition: l.condition };
    if (adj.lt(0)) {
      const { rows: bal } = await tx.query<{ q: string }>(
        `SELECT COALESCE(sum(quantity), 0)::text AS q FROM stock_balances WHERE item_id = $1 AND piece_id IS NOT DISTINCT FROM $2 AND location_id = $3 AND condition = $4`,
        [l.item_id, l.piece_id, l.location_id, l.condition]
      );
      if (new Decimal(bal[0]!.q).lt(adj.abs())) {
        await tx.query("UPDATE count_lines SET decision = 'recount', decision_reason = $2, counted_qty = NULL, recounts = recounts + 1 WHERE id = $1", [lineId, 'Stock moved since the count; recount needed']);
        await tx.query("UPDATE count_sessions SET status = 'open' WHERE id = $1", [l.session_id]);
        return { negative: true };
      }
    }
    let movementId: number | null = null;
    if (!adj.eq(0)) {
      const ref = { type: 'count_line', id: lineId };
      const [id] = await postMovements(tx, [adj.lt(0)
        ? { type: 'adjustment', itemId: l.item_id, pieceId: l.piece_id, quantity: adj.abs().toFixed(3), from: bin, to: { condition: 'lost' }, reason, reference: ref }
        : { type: 'adjustment', itemId: l.item_id, pieceId: l.piece_id, quantity: adj.toFixed(3), to: bin, reason, reference: ref }], { actorUserId: auth.user.id, ctx });
      movementId = id ?? null;
    }
    await tx.query("UPDATE count_lines SET decision = 'approved', decision_reason = $2, decided_by = $3, decided_at = $4, movement_id = $5 WHERE id = $1",
      [lineId, reason, auth.user.id, now(), movementId]);
    await maybeComplete(tx, l.session_id);
    await writeAudit(tx, { action: 'count.line_approved', actorUserId: auth.user.id, entityType: 'count_session', entityId: l.session_id, after: { lineId, adjustment: adj.toFixed(3), reason }, ctx });
    return { negative: false };
  });
  if (result.negative) throw new ApiError('ADJUSTMENT_NEGATIVE');
  return { ok: true };
}
