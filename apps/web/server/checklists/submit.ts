import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { normalisePhone, type Step, type SubmitStep } from '@artoholic/shared';
import { withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { emit } from '../notifications/outbox';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import { postMovements, type MovementInput } from '../stock/post';
import { adminIds, assigneeIds } from '../events/recipients';
import { createReport } from '../damage/reports';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';
import { advanceStatus, expectedFor, isReady, loadStep, requireStepRole, stepInfo, writeEntries } from './steps';
import { dispatchSlices, outSlices } from './stock';

type Tx = Pick<PoolClient, 'query'>;
const D = (v: string | null | undefined) => new Decimal(v ?? 0);

interface Entry {
  id: string; source_id: string; source_type: string; warehouse_id: string | null; reserved_qty: string; item_id: string; tracking_type: string; item_name: string;
  piece_id: string | null; qty_dispatched: string | null; qty_received: string | null; qty_returned: string | null; qty_handed_over: string | null;
  handover_event_id: string | null; qty_consumed: string | null; qty_damaged: string | null; remaining_length: string | null; short_reason: string | null;
  note: string; bin_location_id: string | null; photo_keys: string[];
}

async function entriesOf(tx: Tx, stepId: string): Promise<Entry[]> {
  const { rows } = await tx.query<Entry>(
    `SELECT e.id, s.id AS source_id, s.source_type, s.warehouse_id, s.reserved_qty::text, el.item_id, i.tracking_type, i.name AS item_name, e.piece_id,
            e.qty_dispatched::text, e.qty_received::text, e.qty_returned::text, e.qty_handed_over::text, e.handover_event_id, e.qty_consumed::text,
            e.qty_damaged::text, e.remaining_length::text, e.short_reason, e.note, e.bin_location_id, e.photo_keys
       FROM checklist_entries e JOIN event_line_sources s ON s.id = e.event_line_source_id JOIN event_lines el ON el.id = s.event_line_id
       JOIN items i ON i.id = el.item_id WHERE e.step_id = $1`, [stepId]
  );
  return rows;
}

/**
 * Submits a step once (clarification B): the full table, its version, transport (dispatch), location.
 * Posts the step's movements (research R1), raises damage reports, advances the event status.
 */
export async function submitStep(auth: Authenticated, eventId: string, stepId: string, body: SubmitStep, ctx: RequestContext): Promise<Step> {
  await withTransaction(async (tx) => {
    const s = await stepInfo(tx, eventId, stepId);
    await requireStepRole(auth, s);
    const { rows: locked } = await tx.query<{ status: string; version: number }>('SELECT status, version FROM checklist_steps WHERE id = $1 FOR UPDATE', [stepId]);
    if (locked[0]!.status === 'submitted' || locked[0]!.version !== body.version) throw new ApiError('STEP_ALREADY_SUBMITTED');
    const { rows: ev } = await tx.query<{ status: string; number: string; name: string }>('SELECT status, number, name FROM events WHERE id = $1', [eventId]);
    if (!['scheduled', 'dispatching', 'in_transit', 'at_site', 'returning', 'reconciling'].includes(ev[0]!.status)) throw new ApiError('EVENT_STATE', { status: ev[0]!.status });
    if (!(await isReady(tx, s))) throw new ApiError('STEP_NOT_READY');
    await writeEntries(tx, stepId, body.entries, auth.user.id);
    const entries = await entriesOf(tx, stepId);
    const meta = { eventId, number: ev[0]!.number, name: ev[0]!.name, link: `/events/${eventId}` };
    const fields: Record<string, string> = {};
    const needPhoto: string[] = [];
    const missing: Array<{ entry: Entry; qty: Decimal }> = [];
    const moves: MovementInput[] = [];
    const reports: Array<{ entry: Entry; kind: 'damaged' | 'missing'; qty: Decimal }> = [];
    const ref = { type: 'checklist_step', id: stepId };

    for (const e of entries) {
      const expected = await expectedFor(tx, s.step, s.round_id, e.source_id);
      if (s.step === 'warehouse_dispatch') {
        const sent = D(e.qty_dispatched);
        if (sent.gt(expected)) fields[e.id] = `${e.item_name}: more than planned (${expected.toFixed(3)}); an Admin must add it to the event first`;
        if (sent.lt(expected) && !e.short_reason) fields[e.id] = `${e.item_name}: give a reason for dispatching less than planned`;
        if (e.short_reason === 'other' && sent.lt(expected) && !e.note.trim()) fields[e.id] = `${e.item_name}: add a note for the reason`;
        continue;
      }
      const damaged = D(e.qty_damaged);
      if (damaged.gt(0) && (!e.photo_keys.length || !e.note.trim())) needPhoto.push(e.id);
      if (s.step === 'site_receipt' || s.step === 'warehouse_receipt') {
        const good = D(e.qty_received);
        const rest = expected.minus(good).minus(damaged);
        if (rest.lt(0)) fields[e.id] = `${e.item_name}: more than expected (${expected.toFixed(3)})`;
        else if (rest.gt(0)) missing.push({ entry: e, qty: rest });
        if (s.step === 'warehouse_receipt' && good.gt(0) && !e.bin_location_id) fields[e.id] = `${e.item_name}: choose a bin`;
      } else {
        const consumed = D(e.qty_consumed);
        if (consumed.gt(0) && e.tracking_type === 'counted') fields[e.id] = `${e.item_name}: only measured and cut items can be consumed`;
        if (D(e.qty_handed_over).gt(0) && !e.handover_event_id) fields[e.id] = `${e.item_name}: choose the event receiving the handover`;
        const rest = expected.minus(D(e.qty_returned)).minus(D(e.qty_handed_over)).minus(consumed).minus(damaged);
        if (rest.lt(0)) fields[e.id] = `${e.item_name}: more than received at the site (${expected.toFixed(3)})`;
        else if (rest.gt(0)) missing.push({ entry: e, qty: rest });
      }
      if (damaged.gt(0)) reports.push({ entry: e, kind: 'damaged', qty: damaged });
    }
    if (Object.keys(fields).length) throw new ApiError('VALIDATION_FAILED', { fields });
    if (needPhoto.length) throw new ApiError('PHOTO_REQUIRED', { entryIds: needPhoto });
    if (missing.length && !body.confirmMissing) {
      throw new ApiError('MISSING_NOT_CONFIRMED', { lines: missing.map((m) => ({ entryId: m.entry.id, item: m.entry.item_name, missing: m.qty.toFixed(3) })) });
    }
    for (const m of missing) reports.push({ entry: m.entry, kind: 'missing', qty: m.qty });

    if (s.step === 'warehouse_dispatch') {
      const short: Array<{ item: string; planned: string; dispatched: string; reason: string | null }> = [];
      for (const e of entries) {
        const sent = D(e.qty_dispatched);
        const planned = await expectedFor(tx, s.step, s.round_id, e.source_id);
        if (sent.gt(0)) {
          const { reserved, free } = await dispatchSlices(tx, eventId, e.item_id, s.warehouse_id!, sent, e.piece_id);
          for (const x of reserved) moves.push({ type: 'dispatch', itemId: e.item_id, pieceId: x.pieceId, quantity: x.qty, from: { locationId: x.locationId, eventId, condition: 'reserved' }, to: { eventId, condition: 'out' }, reference: ref });
          for (const x of free) moves.push({ type: 'dispatch', itemId: e.item_id, pieceId: x.pieceId, quantity: x.qty, from: { locationId: x.locationId, condition: 'available' }, to: { eventId, condition: 'out' }, reference: ref });
          const fromReserved = reserved.reduce((a, x) => a.plus(x.qty), new Decimal(0));
          await releaseLeftover(tx, moves, eventId, e, s.warehouse_id!, D(e.reserved_qty).minus(fromReserved), ref);
        } else {
          await releaseLeftover(tx, moves, eventId, e, s.warehouse_id!, D(e.reserved_qty), ref);
        }
        await tx.query('UPDATE event_line_sources SET reserved_qty = 0 WHERE id = $1', [e.source_id]);
        if (sent.lt(planned)) short.push({ item: e.item_name, planned: planned.toFixed(3), dispatched: sent.toFixed(3), reason: e.short_reason });
      }
      const phone = body.transport?.driverPhone ? normalisePhone(body.transport.driverPhone) : null;
      if (body.transport?.driverPhone && !phone) throw new ApiError('VALIDATION_FAILED', { fields: { driverPhone: 'Enter a valid phone number' } });
      await tx.query('UPDATE checklist_steps SET vehicle_number = $2, driver_name = $3, driver_phone_e164 = $4 WHERE id = $1',
        [stepId, body.transport?.vehicleNumber || null, body.transport?.driverName || null, phone]);
      await postMovements(tx, moves, { actorUserId: auth.user.id, ctx });
      if (short.length) await emit(tx, 'checklist.dispatch_short', { recordType: 'event', recordId: eventId, actorUserId: auth.user.id, payload: { ...meta, lines: short, recipientIds: await adminIds(tx) } });
      await emit(tx, 'checklist.dispatched', { recordType: 'event', recordId: eventId, actorUserId: auth.user.id, payload: { ...meta, recipientIds: await assigneeIds(tx, eventId, 'event_manager') } });
    } else if (s.step === 'return_dispatch') {
      for (const e of entries) {
        const consumed = D(e.qty_consumed);
        if (consumed.gt(0)) {
          for (const x of await outSlices(tx, eventId, e.item_id, consumed, e.piece_id)) {
            moves.push({ type: 'consume', itemId: e.item_id, pieceId: x.pieceId, quantity: x.qty, from: { eventId, condition: 'out' }, to: { condition: 'consumed' }, reference: ref });
          }
        }
        const handed = D(e.qty_handed_over);
        if (handed.gt(0)) {
          for (const x of await outSlices(tx, eventId, e.item_id, handed, e.piece_id)) {
            moves.push({ type: 'handover', itemId: e.item_id, pieceId: x.pieceId, quantity: x.qty, from: { eventId, condition: 'out' }, to: { eventId: e.handover_event_id, condition: 'out' }, reference: ref });
          }
          await tx.query('INSERT INTO handovers (giving_event_id, receiving_event_id, item_id, giving_entry_id, quantity) VALUES ($1, $2, $3, $4, $5)',
            [eventId, e.handover_event_id, e.item_id, e.id, handed.toFixed(3)]);
          await emit(tx, 'checklist.handover', { recordType: 'event', recordId: e.handover_event_id!, actorUserId: auth.user.id,
            payload: { eventId: e.handover_event_id, fromEventId: eventId, fromNumber: meta.number, item: e.item_name, quantity: handed.toFixed(3), link: `/events/${e.handover_event_id}`, recipientIds: await assigneeIds(tx, e.handover_event_id!, 'event_manager') } });
        }
      }
      await postMovements(tx, moves, { actorUserId: auth.user.id, ctx });
      await emit(tx, 'checklist.returned', { recordType: 'event', recordId: eventId, actorUserId: auth.user.id, payload: { ...meta, recipientIds: await assigneeIds(tx, eventId, 'store_manager') } });
    } else if (s.step === 'warehouse_receipt') {
      for (const e of entries) {
        const good = D(e.qty_received);
        if (good.lte(0)) continue;
        for (const x of await outSlices(tx, eventId, e.item_id, good, e.piece_id)) {
          moves.push({ type: 'return', itemId: e.item_id, pieceId: x.pieceId, quantity: x.qty, from: { eventId, condition: 'out' }, to: { locationId: e.bin_location_id, condition: 'available' }, reference: ref });
        }
      }
      await postMovements(tx, moves, { actorUserId: auth.user.id, ctx });
    }
    for (const r of reports) {
      if (r.kind === 'missing') await tx.query('UPDATE checklist_entries SET qty_missing = $2 WHERE id = $1', [r.entry.id, r.qty.toFixed(3)]);
      await createReport(tx, { eventId, sourceId: r.entry.source_id, stepId, entryId: r.entry.id, kind: r.kind, quantity: r.qty.toFixed(3),
        note: r.entry.note, photoKeys: r.entry.photo_keys, userId: auth.user.id, location: body.location });
    }
    await tx.query(
      `UPDATE checklist_steps SET status = 'submitted', version = version + 1, submitted_by = $2, submitted_at = $3, client_platform = $4, client_version = $5,
         device_label = $6, latitude = $7, longitude = $8 WHERE id = $1`,
      [stepId, auth.user.id, now(), ctx.platform, ctx.version ?? null, body.deviceLabel ?? null, body.location?.latitude ?? null, body.location?.longitude ?? null]
    );
    const status = await advanceStatus(tx, eventId);
    await writeAudit(tx, { action: `checklist.${s.step}_submitted`, actorUserId: auth.user.id, entityType: 'event', entityId: eventId,
      after: { stepId, round: s.round, warehouseId: s.warehouse_id, status, reports: reports.length }, ctx });
  });
  return loadStep(auth, eventId, stepId);
}

async function releaseLeftover(tx: Tx, moves: MovementInput[], eventId: string, e: Entry, warehouseId: string, qty: Decimal, ref: { type: string; id: string }) {
  if (qty.lte(0)) return;
  const { rows } = await tx.query<{ location_id: string; piece_id: string | null; q: string }>(
    `SELECT b.location_id, b.piece_id, b.quantity::text AS q FROM stock_balances b JOIN locations l ON l.id = b.location_id
      WHERE b.event_id = $1 AND b.item_id = $2 AND l.warehouse_id = $3 AND b.condition = 'reserved' AND b.quantity > 0 ORDER BY l.code`,
    [eventId, e.item_id, warehouseId]
  );
  // Quantities already taken by moves in this submission are not free to release.
  const taken = (loc: string, piece: string | null) => moves.filter((m) => m.itemId === e.item_id && m.from?.locationId === loc && m.from?.condition === 'reserved' && (m.pieceId ?? null) === piece)
    .reduce((a, m) => a.plus(m.quantity), new Decimal(0));
  let left = qty;
  for (const r of rows) {
    if (left.lte(0)) break;
    const free = new Decimal(r.q).minus(taken(r.location_id, r.piece_id));
    const take = Decimal.min(left, free);
    if (take.lte(0)) continue;
    moves.push({ type: 'release', itemId: e.item_id, pieceId: r.piece_id, quantity: take.toFixed(3), from: { locationId: r.location_id, eventId, condition: 'reserved' }, to: { locationId: r.location_id, condition: 'available' }, reference: ref });
    left = left.minus(take);
  }
}

/**
 * The reporter re-checks a rejected line (US3-2): new damaged/missing figures; whatever is no longer
 * damaged or missing counts as good for that step (and, at warehouse receipt, goes into the bin).
 */
export async function recheckReport(auth: Authenticated, reportId: string, input: { damaged: string; missing?: string; note?: string; photoKeys?: string[] }, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ event_id: string; step_id: string; entry_id: string; event_line_source_id: string; kind: string; q: string; status: string; resolved: Date | null }>(
      `SELECT event_id, step_id, entry_id, event_line_source_id, kind, quantity::text AS q, status, resolved_by_recheck_at AS resolved FROM damage_reports WHERE id = $1 FOR UPDATE`, [reportId]
    );
    const d = rows[0];
    if (!d) throw new ApiError('NOT_FOUND');
    if (d.status !== 'rejected' || d.resolved) throw new ApiError('ALREADY_DECIDED', undefined, 'Only a rejected report waiting for a re-check can be re-checked.');
    const s = await stepInfo(tx, d.event_id, d.step_id);
    await requireStepRole(auth, s);
    const newQty = D(d.kind === 'damaged' ? input.damaged : input.missing ?? '0');
    const old = D(d.q);
    if (newQty.gt(old)) throw new ApiError('VALIDATION_FAILED', { fields: { damaged: 'A re-check cannot report more than the original report' } });
    if (d.kind === 'damaged' && newQty.gt(0) && (!input.photoKeys?.length || !input.note?.trim())) throw new ApiError('PHOTO_REQUIRED', { entryIds: [d.entry_id] });
    const good = old.minus(newQty);
    const { rows: en } = await tx.query<{ item_id: string; bin: string | null; piece_id: string | null }>(
      'SELECT el.item_id, e.bin_location_id AS bin, e.piece_id FROM checklist_entries e JOIN event_line_sources s ON s.id = e.event_line_source_id JOIN event_lines el ON el.id = s.event_line_id WHERE e.id = $1', [d.entry_id]
    );
    const col = s.step === 'return_dispatch' ? 'qty_returned' : 'qty_received';
    const qtyCol = d.kind === 'damaged' ? 'qty_damaged' : 'qty_missing';
    await tx.query(`UPDATE checklist_entries SET ${col} = COALESCE(${col}, 0) + $2, ${qtyCol} = $3, note = COALESCE($4, note), photo_keys = COALESCE($5, photo_keys) WHERE id = $1`,
      [d.entry_id, good.toFixed(3), newQty.toFixed(3), input.note ?? null, input.photoKeys ?? null]);
    if (s.step === 'warehouse_receipt' && good.gt(0)) {
      if (!en[0]!.bin) throw new ApiError('VALIDATION_FAILED', { fields: { binLocationId: 'Choose a bin on the line first' } });
      const slices = await outSlices(tx, d.event_id, en[0]!.item_id, good, en[0]!.piece_id);
      await postMovements(tx, slices.map((x) => ({ type: 'return' as const, itemId: en[0]!.item_id, pieceId: x.pieceId, quantity: x.qty,
        from: { eventId: d.event_id, condition: 'out' as const }, to: { locationId: en[0]!.bin, condition: 'available' as const }, reference: { type: 'damage_report', id: reportId } })), { actorUserId: auth.user.id, ctx });
    }
    await tx.query('UPDATE damage_reports SET resolved_by_recheck_at = $2 WHERE id = $1', [reportId, now()]);
    let newReport: string | null = null;
    if (newQty.gt(0)) {
      newReport = await createReport(tx, { eventId: d.event_id, sourceId: d.event_line_source_id, stepId: d.step_id, entryId: d.entry_id, kind: d.kind as 'damaged' | 'missing',
        quantity: newQty.toFixed(3), note: input.note ?? '', photoKeys: input.photoKeys ?? [], userId: auth.user.id });
    }
    await writeAudit(tx, { action: 'damage.rechecked', actorUserId: auth.user.id, entityType: 'event', entityId: d.event_id, after: { reportId, newReport, quantity: newQty.toFixed(3) }, ctx });
    return { reportId, newReportId: newReport };
  });
}
