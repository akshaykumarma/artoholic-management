import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import type { DamageReport } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { emit } from '../notifications/outbox';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import { issueRecordNumber } from '../sequences/issue';
import { getStorage } from '../storage';
import { postMovements } from '../stock/post';
import { adminIds } from '../events/recipients';
import { homeWarehouse } from '../checklists/steps';
import { outSlices, usualBin } from '../checklists/stock';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';

type Tx = Pick<PoolClient, 'query'>;
const isAdmin = (auth: Authenticated) => auth.user.roles.includes('admin') || auth.user.roles.includes('super_admin');
const SIX_MONTHS_MS = 183 * 86_400_000;

/** One report per damaged or missing quantity on a line (FR-005), numbered DMG-YYYY-NNNNN; Admins are told. */
export async function createReport(tx: Tx, r: {
  eventId: string; sourceId: string; stepId: string; entryId: string; kind: 'damaged' | 'missing'; quantity: string; note: string; photoKeys: string[];
  userId: string; location?: { latitude: number; longitude: number };
}): Promise<string> {
  const number = await issueRecordNumber(tx, 'damage_report');
  const { rows } = await tx.query<{ id: string }>(
    `INSERT INTO damage_reports (number, event_id, event_line_source_id, step_id, entry_id, kind, quantity, note, reported_by, reported_at, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [number, r.eventId, r.sourceId, r.stepId, r.entryId, r.kind, r.quantity, r.note, r.userId, now(), r.location?.latitude ?? null, r.location?.longitude ?? null]
  );
  const id = rows[0]!.id;
  for (const key of r.kind === 'damaged' ? r.photoKeys : []) {
    const head = await getStorage().head(key);
    await tx.query('INSERT INTO damage_photos (damage_report_id, storage_key, taken_by, bytes) VALUES ($1, $2, $3, $4)', [id, key, r.userId, head?.bytes ?? null]);
  }
  const { rows: ev } = await tx.query<{ number: string; name: string; item: string }>(
    `SELECT e.number, e.name, i.name AS item FROM events e, event_line_sources s JOIN event_lines el ON el.id = s.event_line_id JOIN items i ON i.id = el.item_id
      WHERE e.id = $1 AND s.id = $2`, [r.eventId, r.sourceId]
  );
  await emit(tx, 'damage.reported', { recordType: 'damage_report', recordId: id, actorUserId: r.userId,
    payload: { reportId: id, number, eventId: r.eventId, eventNumber: ev[0]?.number, item: ev[0]?.item, kind: r.kind, quantity: r.quantity, link: `/approvals/damage/${id}`, recipientIds: await adminIds(tx) } });
  await writeAudit(tx, { action: 'damage.reported', actorUserId: r.userId, entityType: 'event', entityId: r.eventId, after: { reportId: id, number, kind: r.kind, quantity: r.quantity } });
  return id;
}

async function view(db: Tx, id: string): Promise<DamageReport> {
  const { rows } = await db.query(
    `SELECT d.*, d.quantity::text AS q, d.latitude::float8 AS lat, d.longitude::float8 AS lng, e.number AS enumber, e.name AS ename, i.name AS iname, st.step,
            u.full_name AS reporter, du.full_name AS decider
       FROM damage_reports d JOIN events e ON e.id = d.event_id JOIN event_line_sources s ON s.id = d.event_line_source_id
       JOIN event_lines el ON el.id = s.event_line_id JOIN items i ON i.id = el.item_id JOIN checklist_steps st ON st.id = d.step_id
       JOIN users u ON u.id = d.reported_by LEFT JOIN users du ON du.id = d.decided_by WHERE d.id = $1`, [id]
  );
  const d = rows[0];
  if (!d) throw new ApiError('NOT_FOUND');
  const { rows: photos } = await db.query<{ id: string; storage_key: string }>('SELECT id, storage_key FROM damage_photos WHERE damage_report_id = $1 AND deleted_at IS NULL ORDER BY taken_at', [id]);
  return {
    id: d.id, number: d.number, eventId: d.event_id, eventNumber: d.enumber, eventName: d.ename, itemName: d.iname, step: d.step, kind: d.kind,
    quantity: new Decimal(d.q).toFixed(3), note: d.note, reportedBy: d.reporter, reportedAt: new Date(d.reported_at).toISOString(), latitude: d.lat, longitude: d.lng,
    status: d.status, decidedBy: d.decider, decidedAt: d.decided_at ? new Date(d.decided_at).toISOString() : null, decisionComment: d.decision_comment,
    photos: await Promise.all(photos.map(async (p) => ({ id: p.id, url: await getStorage().presignGet(p.storage_key) }))), photosDeleted: !!d.photos_deleted_at
  };
}

export async function getReport(auth: Authenticated, id: string): Promise<DamageReport> {
  const r = await view(getPool(), id);
  if (!isAdmin(auth)) {
    const { rowCount } = await getPool().query('SELECT 1 FROM damage_reports WHERE id = $1 AND reported_by = $2', [id, auth.user.id]);
    if (!rowCount) throw new ApiError('FORBIDDEN');
  }
  return r;
}

/** Admins see all; others see the reports they made. */
export async function listReports(auth: Authenticated, q: { status?: string; eventId?: string }) {
  const { rows } = await getPool().query<{ id: string }>(
    `SELECT d.id FROM damage_reports d WHERE ($1::text IS NULL OR d.status = $1) AND ($2::uuid IS NULL OR d.event_id = $2) AND ($3::boolean OR d.reported_by = $4)
      ORDER BY d.reported_at DESC LIMIT 200`,
    [q.status ?? null, q.eventId ?? null, isAdmin(auth), auth.user.id]
  );
  const pool = getPool();
  return Promise.all(rows.map((r) => view(pool, r.id)));
}

/**
 * Approve (research R1): damaged → out@event becomes damaged in the line's bin (the receipt bin, else
 * the item's usual bin in its home warehouse); missing → lost. Decided once (`ALREADY_DECIDED`).
 */
export async function approveReport(auth: Authenticated, id: string, comment: string | undefined, ctx: RequestContext): Promise<DamageReport> {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ id: string; event_id: string; event_line_source_id: string; entry_id: string; kind: string; q: string; reported_by: string; number: string }>(
      `UPDATE damage_reports SET status = 'approved', decided_by = $2, decided_at = $3, decision_comment = $4 WHERE id = $1 AND status = 'pending'
       RETURNING id, event_id, event_line_source_id, entry_id, kind, quantity::text AS q, reported_by, number`,
      [id, auth.user.id, now(), comment ?? null]
    );
    const d = rows[0];
    if (!d) {
      if (!(await tx.query('SELECT 1 FROM damage_reports WHERE id = $1', [id])).rowCount) throw new ApiError('NOT_FOUND');
      throw new ApiError('ALREADY_DECIDED');
    }
    const { rows: src } = await tx.query<{ item_id: string; bin: string | null }>(
      `SELECT el.item_id, e.bin_location_id AS bin FROM event_line_sources s JOIN event_lines el ON el.id = s.event_line_id, checklist_entries e
        WHERE s.id = $1 AND e.id = $2`, [d.event_line_source_id, d.entry_id]
    );
    const itemId = src[0]!.item_id;
    const slices = await outSlices(tx, d.event_id, itemId, d.q);
    let binId = src[0]!.bin;
    if (d.kind === 'damaged' && !binId) {
      const home = await homeWarehouse(tx, d.event_line_source_id);
      binId = home ? (await usualBin(tx, home, itemId))?.id ?? null : null;
    }
    const ids = await postMovements(tx, slices.map((s) => ({
      type: d.kind === 'damaged' ? 'damage' as const : 'lost' as const, itemId, pieceId: s.pieceId, quantity: s.qty,
      from: { eventId: d.event_id, condition: 'out' as const },
      to: d.kind === 'damaged' ? { locationId: binId, condition: 'damaged' as const } : { condition: 'lost' as const },
      reason: comment ?? null, reference: { type: 'damage_report', id }
    })), { actorUserId: auth.user.id, ctx });
    await tx.query('UPDATE damage_reports SET movement_id = $2 WHERE id = $1', [id, ids[0] ?? null]);
    await tx.query('UPDATE damage_photos SET delete_after = $2 WHERE damage_report_id = $1', [id, new Date(now().getTime() + SIX_MONTHS_MS)]);
    await emit(tx, 'damage.decided', { recordType: 'damage_report', recordId: id, actorUserId: auth.user.id,
      payload: { reportId: id, number: d.number, decision: 'approved', comment: comment ?? null, link: `/approvals/damage/${id}`, recipientIds: [d.reported_by] } });
    await writeAudit(tx, { action: 'damage.approved', actorUserId: auth.user.id, entityType: 'event', entityId: d.event_id, after: { reportId: id, number: d.number, comment }, ctx });
    return view(tx, id);
  });
}

/** Reject reopens the line for the reporter to re-check (US3-2). */
export async function rejectReport(auth: Authenticated, id: string, comment: string, ctx: RequestContext): Promise<DamageReport> {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ event_id: string; reported_by: string; number: string }>(
      `UPDATE damage_reports SET status = 'rejected', decided_by = $2, decided_at = $3, decision_comment = $4 WHERE id = $1 AND status = 'pending'
       RETURNING event_id, reported_by, number`, [id, auth.user.id, now(), comment]
    );
    const d = rows[0];
    if (!d) {
      if (!(await tx.query('SELECT 1 FROM damage_reports WHERE id = $1', [id])).rowCount) throw new ApiError('NOT_FOUND');
      throw new ApiError('ALREADY_DECIDED');
    }
    await tx.query('UPDATE damage_photos SET delete_after = $2 WHERE damage_report_id = $1', [id, new Date(now().getTime() + SIX_MONTHS_MS)]);
    await emit(tx, 'damage.decided', { recordType: 'damage_report', recordId: id, actorUserId: auth.user.id,
      payload: { reportId: id, number: d.number, decision: 'rejected', comment, link: `/events/${d.event_id}`, recipientIds: [d.reported_by] } });
    await writeAudit(tx, { action: 'damage.rejected', actorUserId: auth.user.id, entityType: 'event', entityId: d.event_id, after: { reportId: id, number: d.number, comment }, ctx });
    return view(tx, id);
  });
}
