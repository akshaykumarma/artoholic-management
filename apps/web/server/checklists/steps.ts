import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import type { EntryInput, Rounds, Step, StepRow, StepType } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { requireEventAccess } from '../events/events';
import type { Authenticated } from '../auth/sessions';
import { now } from '../auth/clock';
import { usualBin } from './stock';

type Tx = Pick<PoolClient, 'query'>;
const q3 = (v: string | null) => (v === null ? null : new Decimal(v).toFixed(3));
const isAdmin = (auth: Authenticated) => auth.user.roles.includes('admin') || auth.user.roles.includes('super_admin');
const ACTIVE = ['dispatching', 'in_transit', 'at_site', 'returning', 'reconciling', 'scheduled', 'closed'];

/** Warehouse a source's stock goes home to: its own warehouse, or (handover) the giving event's (FR-008a). */
export async function homeWarehouse(tx: Tx, sourceId: string, depth = 0): Promise<string | null> {
  const { rows } = await tx.query<{ warehouse_id: string | null; source_event_id: string | null; item_id: string }>(
    'SELECT s.warehouse_id, s.source_event_id, el.item_id FROM event_line_sources s JOIN event_lines el ON el.id = s.event_line_id WHERE s.id = $1', [sourceId]
  );
  const s = rows[0];
  if (!s) return null;
  if (s.warehouse_id || depth > 5) return s.warehouse_id;
  const { rows: g } = await tx.query<{ id: string }>(
    'SELECT s.id FROM event_line_sources s JOIN event_lines el ON el.id = s.event_line_id WHERE el.event_id = $1 AND el.item_id = $2 ORDER BY s.warehouse_id NULLS LAST LIMIT 1',
    [s.source_event_id, s.item_id]
  );
  return g[0] ? homeWarehouse(tx, g[0].id, depth + 1) : null;
}

/** Creates the rounds, the four steps per round (warehouse steps per warehouse) and their entry rows. */
export async function ensureSteps(tx: Tx, eventId: string): Promise<void> {
  const { rows: srcs } = await tx.query<{ id: string; round: number; warehouse_id: string | null }>(
    `SELECT s.id, el.round, s.warehouse_id FROM event_line_sources s JOIN event_lines el ON el.id = s.event_line_id WHERE el.event_id = $1`, [eventId]
  );
  const rounds = [...new Set(srcs.map((s) => s.round))];
  for (const r of rounds) {
    await tx.query('INSERT INTO dispatch_rounds (event_id, round) VALUES ($1, $2) ON CONFLICT DO NOTHING', [eventId, r]);
    const { rows: rr } = await tx.query<{ id: string }>('SELECT id FROM dispatch_rounds WHERE event_id = $1 AND round = $2', [eventId, r]);
    const roundId = rr[0]!.id;
    const mine = srcs.filter((s) => s.round === r);
    const step = async (type: StepType, warehouseId: string | null, sourceIds: string[]) => {
      await tx.query(
        `INSERT INTO checklist_steps (round_id, step, warehouse_id) VALUES ($1, $2, $3)
         ON CONFLICT (round_id, step, COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000')) DO NOTHING`,
        [roundId, type, warehouseId]
      );
      const { rows: st } = await tx.query<{ id: string }>(
        `SELECT id FROM checklist_steps WHERE round_id = $1 AND step = $2 AND warehouse_id IS NOT DISTINCT FROM $3::uuid`, [roundId, type, warehouseId]
      );
      for (const sid of sourceIds) {
        await tx.query('INSERT INTO checklist_entries (step_id, event_line_source_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [st[0]!.id, sid]);
      }
    };
    for (const w of new Set(mine.filter((s) => s.warehouse_id).map((s) => s.warehouse_id!))) {
      await step('warehouse_dispatch', w, mine.filter((s) => s.warehouse_id === w).map((s) => s.id));
    }
    await step('site_receipt', null, mine.map((s) => s.id));
    await step('return_dispatch', null, mine.map((s) => s.id));
    const homes = new Map<string, string[]>();
    for (const s of mine) {
      const h = await homeWarehouse(tx, s.id);
      if (h) homes.set(h, [...(homes.get(h) ?? []), s.id]);
    }
    for (const [w, ids] of homes) await step('warehouse_receipt', w, ids);
  }
}

interface StepInfo { id: string; event_id: string; round: number; round_id: string; step: StepType; warehouse_id: string | null; status: string; version: number }

export async function stepInfo(tx: Tx, eventId: string, stepId: string): Promise<StepInfo> {
  const { rows } = await tx.query<StepInfo>(
    `SELECT s.id, r.event_id, r.round, r.id AS round_id, s.step, s.warehouse_id, s.status, s.version
       FROM checklist_steps s JOIN dispatch_rounds r ON r.id = s.round_id WHERE s.id = $1 AND r.event_id = $2`,
    [stepId, eventId]
  );
  if (!rows[0]) throw new ApiError('NOT_FOUND');
  return rows[0];
}

/** Whether the step before this one is done (STEP_NOT_READY otherwise). */
export async function isReady(tx: Tx, s: Pick<StepInfo, 'round_id' | 'step' | 'id'>): Promise<boolean> {
  const status = async (type: StepType) => (await tx.query<{ status: string }>('SELECT status FROM checklist_steps WHERE round_id = $1 AND step = $2', [s.round_id, type])).rows;
  if (s.step === 'warehouse_dispatch') return true;
  if (s.step === 'site_receipt') {
    const d = await status('warehouse_dispatch');
    if (d.some((x) => x.status !== 'submitted')) return false;
    // Handover sources: the giving event must have handed something over (FR-008a).
    const { rows } = await tx.query<{ ok: boolean }>(
      `SELECT bool_and(EXISTS (SELECT 1 FROM handovers h WHERE h.receiving_event_id = el.event_id AND h.giving_event_id = src.source_event_id AND h.item_id = el.item_id)) AS ok
         FROM checklist_entries e JOIN event_line_sources src ON src.id = e.event_line_source_id JOIN event_lines el ON el.id = src.event_line_id
        WHERE e.step_id = $1 AND src.source_type = 'event'`,
      [s.id]
    );
    return rows[0]?.ok !== false;
  }
  if (s.step === 'return_dispatch') return (await status('site_receipt')).every((x) => x.status === 'submitted');
  return (await status('return_dispatch')).every((x) => x.status === 'submitted');
}

/** Warehouse steps: that warehouse's Store Managers; site and return: the event's Event Managers; Admins: any. */
export async function canPerform(auth: Authenticated, s: Pick<StepInfo, 'event_id' | 'step' | 'warehouse_id'>): Promise<boolean> {
  if (isAdmin(auth)) return true;
  const pool = getPool();
  if (s.warehouse_id) {
    if (!auth.user.roles.includes('store_manager')) return false;
    return !!(await pool.query('SELECT 1 FROM warehouse_assignments WHERE user_id = $1 AND warehouse_id = $2 AND unassigned_at IS NULL', [auth.user.id, s.warehouse_id])).rowCount;
  }
  if (!auth.user.roles.includes('event_manager')) return false;
  return !!(await pool.query("SELECT 1 FROM event_assignments WHERE event_id = $1 AND user_id = $2 AND role_on_event = 'event_manager' AND removed_at IS NULL", [s.event_id, auth.user.id])).rowCount;
}

export async function requireStepRole(auth: Authenticated, s: StepInfo) {
  if (!(await canPerform(auth, s))) throw new ApiError('FORBIDDEN');
}

async function eventStatus(tx: Tx, eventId: string): Promise<string> {
  const { rows } = await tx.query<{ status: string }>('SELECT status FROM events WHERE id = $1', [eventId]);
  if (!rows[0]) throw new ApiError('NOT_FOUND');
  return rows[0].status;
}

export async function getRounds(auth: Authenticated, eventId: string): Promise<Rounds> {
  await requireEventAccess(auth, eventId);
  const status = await eventStatus(getPool(), eventId);
  if (ACTIVE.includes(status)) await withTransaction((tx) => ensureSteps(tx, eventId));
  const pool = getPool();
  const { rows: rounds } = await pool.query<{ id: string; round: number }>('SELECT id, round FROM dispatch_rounds WHERE event_id = $1 ORDER BY round', [eventId]);
  const order: Record<string, number> = { warehouse_dispatch: 0, site_receipt: 1, return_dispatch: 2, warehouse_receipt: 3 };
  const out: Rounds['rounds'] = [];
  for (const r of rounds) {
    const { rows: steps } = await pool.query<{ id: string; step: StepType; warehouse_id: string | null; code: string | null; status: 'not_started' | 'in_progress' | 'submitted'; submitted_at: Date | null }>(
      `SELECT s.id, s.step, s.warehouse_id, w.code, s.status, s.submitted_at FROM checklist_steps s LEFT JOIN warehouses w ON w.id = s.warehouse_id WHERE s.round_id = $1`, [r.id]
    );
    steps.sort((a, b) => order[a.step]! - order[b.step]! || (a.code ?? '').localeCompare(b.code ?? ''));
    const list = [];
    for (const s of steps) {
      list.push({
        id: s.id, step: s.step, warehouseId: s.warehouse_id, warehouseCode: s.code, status: s.status,
        ready: await isReady(pool, { round_id: r.id, step: s.step, id: s.id }),
        canPerform: status !== 'closed' && status !== 'cancelled' && (await canPerform(auth, { event_id: eventId, step: s.step, warehouse_id: s.warehouse_id })),
        submittedAt: s.submitted_at ? new Date(s.submitted_at).toISOString() : null
      });
    }
    out.push({ id: r.id, round: r.round, steps: list });
  }
  return { eventId, status: status as Rounds['status'], rounds: out };
}

/** What the step expects per source: planned, or what the previous step handed on. */
export async function expectedFor(tx: Tx, step: StepType, roundId: string, sourceId: string): Promise<Decimal> {
  const prev = async (type: StepType, col: string) => {
    const { rows } = await tx.query<{ q: string | null }>(
      `SELECT sum(e.${col})::text AS q FROM checklist_entries e JOIN checklist_steps s ON s.id = e.step_id
        WHERE s.round_id = $1 AND s.step = $2 AND s.status = 'submitted' AND e.event_line_source_id = $3`,
      [roundId, type, sourceId]
    );
    return new Decimal(rows[0]?.q ?? 0);
  };
  if (step === 'warehouse_dispatch') {
    const { rows } = await tx.query<{ q: string }>('SELECT planned_qty::text AS q FROM event_line_sources WHERE id = $1', [sourceId]);
    return new Decimal(rows[0]!.q);
  }
  if (step === 'site_receipt') return dispatchedFor(tx, roundId, sourceId);
  if (step === 'return_dispatch') return prev('site_receipt', 'qty_received');
  return prev('return_dispatch', 'qty_returned');
}

/** Dispatched per source: the warehouse dispatch, or (handover source) what the giving event handed over. */
export async function dispatchedFor(tx: Tx, roundId: string | null, sourceId: string): Promise<Decimal> {
  const { rows: s } = await tx.query<{ source_type: string; source_event_id: string | null; event_id: string; item_id: string }>(
    'SELECT s.source_type, s.source_event_id, el.event_id, el.item_id FROM event_line_sources s JOIN event_lines el ON el.id = s.event_line_id WHERE s.id = $1', [sourceId]
  );
  const src = s[0]!;
  if (src.source_type === 'event') {
    const { rows } = await tx.query<{ q: string | null }>(
      'SELECT sum(quantity)::text AS q FROM handovers WHERE receiving_event_id = $1 AND giving_event_id = $2 AND item_id = $3', [src.event_id, src.source_event_id, src.item_id]
    );
    return new Decimal(rows[0]?.q ?? 0);
  }
  const { rows } = await tx.query<{ q: string | null }>(
    `SELECT sum(e.qty_dispatched)::text AS q FROM checklist_entries e JOIN checklist_steps st ON st.id = e.step_id
      WHERE st.step = 'warehouse_dispatch' AND st.status = 'submitted' AND e.event_line_source_id = $1 AND ($2::uuid IS NULL OR st.round_id = $2)`,
    [sourceId, roundId]
  );
  return new Decimal(rows[0]?.q ?? 0);
}

export async function loadStep(auth: Authenticated, eventId: string, stepId: string): Promise<Step> {
  await requireEventAccess(auth, eventId);
  const pool = getPool();
  await withTransaction((tx) => ensureSteps(tx, eventId));
  const s = await stepInfo(pool, eventId, stepId);
  const { rows: ev } = await pool.query<{ number: string; name: string }>('SELECT number, name FROM events WHERE id = $1', [eventId]);
  const { rows: meta } = await pool.query<{ code: string | null; submitted_at: Date | null; by: string | null; vehicle_number: string | null; driver_name: string | null; driver_phone_e164: string | null }>(
    `SELECT w.code, s.submitted_at, u.full_name AS by, s.vehicle_number, s.driver_name, s.driver_phone_e164
       FROM checklist_steps s LEFT JOIN warehouses w ON w.id = s.warehouse_id LEFT JOIN users u ON u.id = s.submitted_by WHERE s.id = $1`, [stepId]
  );
  const { rows: entries } = await pool.query(
    `SELECT e.*, e.qty_dispatched::text AS d, e.qty_received::text AS r, e.qty_returned::text AS rt, e.qty_handed_over::text AS h, e.qty_consumed::text AS c,
            e.qty_damaged::text AS dm, e.qty_missing::text AS m, e.remaining_length::text AS rl,
            src.id AS source_id, src.source_type, src.source_event_id, sw.code AS source_wcode, se.number AS source_enumber,
            el.item_id, el.event_id, i.name AS item_name, i.tracking_type, i.unit_code, c.code AS item_code
       FROM checklist_entries e JOIN event_line_sources src ON src.id = e.event_line_source_id JOIN event_lines el ON el.id = src.event_line_id
       JOIN items i ON i.id = el.item_id JOIN item_codes c ON c.item_id = i.id AND c.active_to IS NULL
       LEFT JOIN warehouses sw ON sw.id = src.warehouse_id LEFT JOIN events se ON se.id = src.source_event_id
      WHERE e.step_id = $1`,
    [stepId]
  );
  const rows: Array<StepRow & { sortKey: string }> = [];
  for (const e of entries) {
    const bin = s.warehouse_id ? await usualBin(pool, s.warehouse_id, e.item_id) : null;
    const handoverOptions = s.step === 'return_dispatch'
      ? (await pool.query<{ id: string; number: string; name: string }>(
        `SELECT DISTINCT y.id, y.number, y.name FROM event_line_sources s2 JOIN event_lines l2 ON l2.id = s2.event_line_id JOIN events y ON y.id = l2.event_id
          WHERE s2.source_event_id = $1 AND l2.item_id = $2 AND y.status NOT IN ('draft', 'cancelled')`, [eventId, e.item_id])).rows.map((y) => ({ eventId: y.id, number: y.number, name: y.name }))
      : [];
    const pieceOptions = s.step === 'warehouse_dispatch' && e.tracking_type === 'cut' && s.warehouse_id
      ? (await pool.query<{ id: string; piece_number: string; q: string }>(
        `SELECT p.id, p.piece_number, sum(b.quantity)::text AS q FROM stock_balances b JOIN item_pieces p ON p.id = b.piece_id JOIN locations l ON l.id = b.location_id
          WHERE b.item_id = $1 AND l.warehouse_id = $2 AND b.quantity > 0 AND (b.condition = 'available' OR (b.condition = 'reserved' AND b.event_id = $3))
          GROUP BY p.id ORDER BY p.piece_number`, [e.item_id, s.warehouse_id, eventId])).rows.map((p) => ({ id: p.id, number: p.piece_number, length: q3(p.q)! }))
      : [];
    const { rows: recheck } = await pool.query<{ id: string }>(
      "SELECT id FROM damage_reports WHERE entry_id = $1 AND status = 'rejected' AND resolved_by_recheck_at IS NULL ORDER BY reported_at LIMIT 1", [e.id]
    );
    rows.push({
      sortKey: `${bin?.code ?? 'zzz'}|${e.item_name}`,
      entryId: e.id, sourceId: e.source_id, itemId: e.item_id, itemCode: e.item_code, itemName: e.item_name, trackingType: e.tracking_type, unitCode: e.unit_code,
      sourceLabel: e.source_type === 'warehouse' ? e.source_wcode : e.source_enumber, usualBin: bin?.code ?? null,
      expected: (await expectedFor(pool, s.step, s.round_id, e.source_id)).toFixed(3),
      done: e.done, dispatched: q3(e.d), received: q3(e.r), returned: q3(e.rt), handedOver: q3(e.h), handoverEventId: e.handover_event_id, handoverOptions,
      consumed: q3(e.c), damaged: q3(e.dm), missing: q3(e.m), remainingLength: q3(e.rl), shortReason: e.short_reason, note: e.note,
      binLocationId: e.bin_location_id ?? (s.step === 'warehouse_receipt' ? bin?.id ?? null : null), pieceId: e.piece_id, pieceOptions, photoKeys: e.photo_keys,
      recheckReportId: recheck[0]?.id ?? null
    });
  }
  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const bins = s.step === 'warehouse_receipt' && s.warehouse_id
    ? (await pool.query<{ id: string; code: string }>(
      `WITH lv AS (SELECT count(*)::int AS n FROM warehouse_levels WHERE warehouse_id = $1)
       SELECT l.id, l.code FROM locations l, lv WHERE l.warehouse_id = $1 AND l.status = 'active'
         AND ((NOT EXISTS (SELECT 1 FROM locations x WHERE x.warehouse_id = $1 AND x.level > 0) AND l.is_default) OR (lv.n > 0 AND NOT l.is_default AND l.level = lv.n))
       ORDER BY l.code LIMIT 2000`, [s.warehouse_id])).rows
    : [];
  const m = meta[0]!;
  return {
    id: s.id, eventId, eventNumber: ev[0]!.number, eventName: ev[0]!.name, round: s.round, step: s.step, warehouseId: s.warehouse_id, warehouseCode: m.code,
    status: s.status as Step['status'], version: s.version, ready: await isReady(pool, s),
    submittedAt: m.submitted_at ? new Date(m.submitted_at).toISOString() : null, submittedBy: m.by,
    transport: { vehicleNumber: m.vehicle_number, driverName: m.driver_name, driverPhone: m.driver_phone_e164 },
    bins, rows: rows.map(({ sortKey: _k, ...r }) => r)
  };
}

const COLS: Record<string, string> = {
  dispatched: 'qty_dispatched', received: 'qty_received', returned: 'qty_returned', handedOver: 'qty_handed_over', handoverEventId: 'handover_event_id',
  consumed: 'qty_consumed', damaged: 'qty_damaged', remainingLength: 'remaining_length', shortReason: 'short_reason', note: 'note',
  binLocationId: 'bin_location_id', pieceId: 'piece_id', photoKeys: 'photo_keys', done: 'done'
};

/** Writes entry fields for this step (part-way saves and submission). */
export async function writeEntries(tx: Tx, stepId: string, entries: EntryInput[], userId: string): Promise<void> {
  for (const e of entries) {
    const sets: string[] = [];
    const vals: unknown[] = [e.entryId, stepId];
    for (const [k, col] of Object.entries(COLS)) {
      const v = (e as Record<string, unknown>)[k];
      if (v === undefined) continue;
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    }
    vals.push(userId, now());
    sets.push(`updated_by = $${vals.length - 1}`, `updated_at = $${vals.length}`);
    const r = await tx.query(`UPDATE checklist_entries SET ${sets.join(', ')} WHERE id = $1 AND step_id = $2`, vals);
    if (!r.rowCount) throw new ApiError('VALIDATION_FAILED', { fields: { entryId: 'That line is not on this checklist' } });
  }
}

/** Part-way save so a second device sees progress (research R3). */
export async function saveProgress(auth: Authenticated, eventId: string, stepId: string, entries: EntryInput[]): Promise<{ saved: number }> {
  return withTransaction(async (tx) => {
    const s = await stepInfo(tx, eventId, stepId);
    await requireStepRole(auth, s);
    await tx.query('SELECT 1 FROM checklist_steps WHERE id = $1 FOR UPDATE', [stepId]);
    const { rows } = await tx.query<{ status: string }>('SELECT status FROM checklist_steps WHERE id = $1', [stepId]);
    if (rows[0]!.status === 'submitted') throw new ApiError('STEP_ALREADY_SUBMITTED');
    await writeEntries(tx, stepId, entries, auth.user.id);
    await tx.query("UPDATE checklist_steps SET status = 'in_progress' WHERE id = $1 AND status = 'not_started'", [stepId]);
    return { saved: entries.length };
  });
}

const ORDER = ['draft', 'scheduled', 'dispatching', 'in_transit', 'at_site', 'returning', 'reconciling', 'closed'];

/** Status follows the steps and never moves backwards (FR-009, research R6). */
export async function advanceStatus(tx: Tx, eventId: string): Promise<string> {
  const { rows } = await tx.query<{ round: number; step: StepType; status: string }>(
    'SELECT r.round, s.step, s.status FROM checklist_steps s JOIN dispatch_rounds r ON r.id = s.round_id WHERE r.event_id = $1', [eventId]
  );
  const r1 = rows.filter((r) => r.round === 1);
  const sub = (type: StepType, set = r1) => set.filter((r) => r.step === type);
  const allDone = (list: typeof rows) => list.length > 0 && list.every((r) => r.status === 'submitted');
  let target = 'scheduled';
  if (sub('warehouse_dispatch').some((r) => r.status === 'submitted')) target = 'dispatching';
  if (allDone(sub('warehouse_dispatch'))) target = 'in_transit';
  if (allDone(sub('site_receipt'))) target = 'at_site';
  if (allDone(sub('return_dispatch'))) target = 'returning';
  if (allDone(sub('warehouse_receipt', rows)) && allDone(sub('return_dispatch', rows))) target = 'reconciling';
  const { rows: ev } = await tx.query<{ status: string }>('SELECT status FROM events WHERE id = $1 FOR UPDATE', [eventId]);
  const current = ev[0]!.status;
  if (ORDER.indexOf(target) > ORDER.indexOf(current) && current !== 'closed' && current !== 'cancelled') {
    await tx.query('UPDATE events SET status = $2, version = version + 1 WHERE id = $1', [eventId, target]);
    return target;
  }
  return current;
}
