import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { istDate, normalisePhone, type EventDetail, type EventInput, type EventLineInput } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import { emit } from '../notifications/outbox';
import { now } from '../auth/clock';
import { issueRecordNumber } from '../sequences/issue';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';
import { syncReservations } from './reservations';
import { evaluateWarnings, relatedEvents } from './warnings';

/** After a change: freed stock tops up others' reservations (first scheduled first), then warnings follow. */
async function followUp(tx: Tx, eventId: string, itemIds: string[], actorUserId: string, ctx: RequestContext) {
  const related = await relatedEvents(tx, eventId, itemIds);
  for (const other of related) if (other !== eventId) await syncReservations(tx, other, actorUserId, ctx);
  await evaluateWarnings(tx, related, actorUserId);
}
import { assigneeIds } from './recipients';

type Tx = Pick<PoolClient, 'query'>;
const q3 = (v: string) => new Decimal(v).toFixed(3);
const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

const isAdmin = (auth: Authenticated) => auth.user.roles.includes('admin') || auth.user.roles.includes('super_admin');

/** SQL condition: the user may see the event (assigned, or a Store Manager of a source warehouse). */
export const VISIBLE = (eventCol: string, userParam: string) => `(
  EXISTS (SELECT 1 FROM event_assignments a WHERE a.event_id = ${eventCol} AND a.user_id = ${userParam} AND a.removed_at IS NULL)
  OR EXISTS (SELECT 1 FROM event_lines vl JOIN event_line_sources vs ON vs.event_line_id = vl.id
              JOIN warehouse_assignments wa ON wa.warehouse_id = vs.warehouse_id AND wa.user_id = ${userParam} AND wa.unassigned_at IS NULL
             WHERE vl.event_id = ${eventCol})
  OR EXISTS (SELECT 1 FROM dispatch_rounds vr JOIN checklist_steps vst ON vst.round_id = vr.id
              JOIN warehouse_assignments wa2 ON wa2.warehouse_id = vst.warehouse_id AND wa2.user_id = ${userParam} AND wa2.unassigned_at IS NULL
             WHERE vr.event_id = ${eventCol}))`;

/** Managers see only their events (005 FR-010); Admins see all. */
export async function requireEventAccess(auth: Authenticated, eventId: string): Promise<void> {
  if (isAdmin(auth)) return;
  const { rowCount } = await getPool().query(`SELECT 1 FROM events e WHERE e.id = $1 AND ${VISIBLE('e.id', '$2')}`, [eventId, auth.user.id]);
  if (!rowCount) throw new ApiError('FORBIDDEN');
}

export async function eventDetail(db: Tx, id: string): Promise<EventDetail> {
  const { rows } = await db.query(
    `SELECT e.*, e.latitude::float8 AS lat, e.longitude::float8 AS lng, e.expected_return_date::text AS ret, t.name AS type_name
       FROM events e LEFT JOIN event_types t ON t.id = e.type_id WHERE e.id = $1`,
    [id]
  );
  const e = rows[0];
  if (!e) throw new ApiError('NOT_FOUND');
  const people = await db.query<{ id: string; full_name: string; role_on_event: string }>(
    `SELECT u.id, u.full_name, a.role_on_event FROM event_assignments a JOIN users u ON u.id = a.user_id
      WHERE a.event_id = $1 AND a.removed_at IS NULL ORDER BY u.full_name`,
    [id]
  );
  const lines = await db.query<{ id: string; item_id: string; code: string; name: string; unit_code: string | null; planned_qty: string; notes: string }>(
    `SELECT el.id, el.item_id, c.code, i.name, i.unit_code, el.planned_qty::text, el.notes
       FROM event_lines el JOIN items i ON i.id = el.item_id JOIN item_codes c ON c.item_id = i.id AND c.active_to IS NULL
      WHERE el.event_id = $1 ORDER BY el.position, el.id`,
    [id]
  );
  const sources = await db.query<{ event_line_id: string; source_type: 'warehouse' | 'event'; warehouse_id: string | null; wcode: string | null; source_event_id: string | null; enumber: string | null; planned_qty: string; reserved_qty: string }>(
    `SELECT s.event_line_id, s.source_type, s.warehouse_id, w.code AS wcode, s.source_event_id, x.number AS enumber, s.planned_qty::text, s.reserved_qty::text
       FROM event_line_sources s JOIN event_lines el ON el.id = s.event_line_id
       LEFT JOIN warehouses w ON w.id = s.warehouse_id LEFT JOIN events x ON x.id = s.source_event_id
      WHERE el.event_id = $1 ORDER BY s.id`,
    [id]
  );
  const warnings = await db.query<{ id: string; item_id: string; iname: string; warehouse_id: string | null; wcode: string | null; source_event_id: string | null; shortfall_qty: string; clashing_event_ids: string[]; raised_at: Date }>(
    `SELECT o.id, o.item_id, i.name AS iname, o.warehouse_id, w.code AS wcode, o.source_event_id, o.shortfall_qty::text, o.clashing_event_ids, o.raised_at
       FROM overbooking_warnings o JOIN items i ON i.id = o.item_id LEFT JOIN warehouses w ON w.id = o.warehouse_id
      WHERE o.event_id = $1 AND o.resolved_at IS NULL ORDER BY i.name`,
    [id]
  );
  const clashIds = [...new Set(warnings.rows.flatMap((w) => w.clashing_event_ids))];
  const clashRows = clashIds.length ? (await db.query<{ id: string; number: string; name: string }>('SELECT id, number, name FROM events WHERE id = ANY($1::uuid[])', [clashIds])).rows : [];
  const clashMap = new Map(clashRows.map((c) => [c.id, c]));
  const clashWarnings = await db.query<{ event_id: string; number: string; name: string; iname: string; shortfall_qty: string }>(
    `SELECT o.event_id, e.number, e.name, i.name AS iname, o.shortfall_qty::text FROM overbooking_warnings o
       JOIN events e ON e.id = o.event_id JOIN items i ON i.id = o.item_id
      WHERE o.resolved_at IS NULL AND $1 = ANY(o.clashing_event_ids) ORDER BY e.number`,
    [id]
  );
  const suggested = await db.query<{ id: string; full_name: string; code: string }>(
    `SELECT DISTINCT u.id, u.full_name, w.code FROM event_line_sources s JOIN event_lines el ON el.id = s.event_line_id
       JOIN warehouses w ON w.id = s.warehouse_id
       JOIN warehouse_assignments wa ON wa.warehouse_id = w.id AND wa.unassigned_at IS NULL
       JOIN users u ON u.id = wa.user_id AND u.status = 'active'
      WHERE el.event_id = $1 ORDER BY w.code, u.full_name`,
    [id]
  );
  const without = await db.query<{ id: string }>(
    `SELECT DISTINCT el.id FROM event_lines el JOIN event_line_sources s ON s.event_line_id = el.id AND s.source_type = 'warehouse'
      WHERE el.event_id = $1 AND NOT EXISTS (
        SELECT 1 FROM event_assignments a JOIN warehouse_assignments wa ON wa.user_id = a.user_id AND wa.warehouse_id = s.warehouse_id AND wa.unassigned_at IS NULL
         WHERE a.event_id = el.event_id AND a.role_on_event = 'store_manager' AND a.removed_at IS NULL)`,
    [id]
  );
  return {
    id: e.id, number: e.number, name: e.name, typeId: e.type_id, typeName: e.type_name, description: e.description,
    venueName: e.venue_name, venueAddress: e.venue_address, latitude: e.lat, longitude: e.lng,
    startsAt: iso(e.starts_at), endsAt: iso(e.ends_at), leaveWarehouseAt: iso(e.leave_warehouse_at), expectedReturnDate: e.ret,
    siteContactName: e.site_contact_name, siteContactPhone: e.site_contact_phone_e164, notes: e.notes, status: e.status,
    cancelledReason: e.cancelled_reason, version: e.version,
    eventManagers: people.rows.filter((p) => p.role_on_event === 'event_manager').map((p) => ({ id: p.id, fullName: p.full_name })),
    storeManagers: people.rows.filter((p) => p.role_on_event === 'store_manager').map((p) => ({ id: p.id, fullName: p.full_name })),
    suggestedStoreManagers: suggested.rows.map((s) => ({ id: s.id, fullName: s.full_name, warehouseCode: s.code })),
    lines: lines.rows.map((l) => ({
      id: l.id, itemId: l.item_id, itemCode: l.code, itemName: l.name, unitCode: l.unit_code, plannedQty: q3(l.planned_qty), notes: l.notes,
      sources: sources.rows.filter((s) => s.event_line_id === l.id).map((s) => ({
        type: s.source_type, warehouseId: s.warehouse_id, warehouseCode: s.wcode, eventId: s.source_event_id, eventNumber: s.enumber,
        qty: q3(s.planned_qty), reservedQty: q3(s.reserved_qty)
      }))
    })),
    warnings: warnings.rows.map((w) => ({
      id: w.id, itemId: w.item_id, itemName: w.iname, warehouseId: w.warehouse_id, warehouseCode: w.wcode, sourceEventId: w.source_event_id,
      shortfallQty: q3(w.shortfall_qty), raisedAt: new Date(w.raised_at).toISOString(),
      clashingEvents: w.clashing_event_ids.map((c) => clashMap.get(c)).filter((c): c is { id: string; number: string; name: string } => !!c)
    })),
    clashWarnings: clashWarnings.rows.map((c) => ({ eventId: c.event_id, eventNumber: c.number, eventName: c.name, itemName: c.iname, shortfallQty: q3(c.shortfall_qty) })),
    linesWithoutStoreManager: without.rows.map((r) => r.id)
  };
}

export async function getEvent(auth: Authenticated, id: string): Promise<EventDetail> {
  await requireEventAccess(auth, id);
  return eventDetail(getPool(), id);
}

/** Date rules apply whenever both values are present (005 US1-2). */
function checkDates(d: EventDetail) {
  const fields: Record<string, string> = {};
  if (d.startsAt && d.endsAt && d.endsAt < d.startsAt) fields.endsAt = 'The end must be after the start';
  if (d.leaveWarehouseAt && d.startsAt && d.leaveWarehouseAt > d.startsAt) fields.leaveWarehouseAt = 'Items must leave the warehouse before the event starts';
  if (d.expectedReturnDate && d.endsAt && d.expectedReturnDate < istDate(d.endsAt)) fields.expectedReturnDate = 'The return date must be on or after the end date';
  if (Object.keys(fields).length) throw new ApiError('VALIDATION_FAILED', { fields });
}

function missingToSchedule(d: EventDetail): string[] {
  const m: string[] = [];
  if (!d.name.trim()) m.push('name');
  if (!d.venueName.trim()) m.push('venueName');
  if (!d.startsAt) m.push('startsAt');
  if (!d.endsAt) m.push('endsAt');
  if (!d.leaveWarehouseAt) m.push('leaveWarehouseAt');
  if (!d.expectedReturnDate) m.push('expectedReturnDate');
  if (!d.eventManagers.length) m.push('eventManagerIds');
  if (!d.lines.length) m.push('lines');
  return m;
}

async function setPeople(tx: Tx, eventId: string, role: 'event_manager' | 'store_manager', ids: string[]) {
  if (ids.length) {
    const { rows } = await tx.query<{ id: string }>(
      "SELECT u.id FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = $2 WHERE u.id = ANY($1::uuid[]) AND u.status = 'active'",
      [ids, role]
    );
    if (rows.length !== new Set(ids).size) {
      throw new ApiError('VALIDATION_FAILED', { fields: { [role === 'event_manager' ? 'eventManagerIds' : 'storeManagerIds']: `Choose active users with the ${role === 'event_manager' ? 'Event' : 'Store'} Manager role` } });
    }
  }
  await tx.query('UPDATE event_assignments SET removed_at = $4 WHERE event_id = $1 AND role_on_event = $2 AND removed_at IS NULL AND NOT (user_id = ANY($3::uuid[]))', [eventId, role, ids, now()]);
  for (const uid of new Set(ids)) {
    await tx.query(
      `INSERT INTO event_assignments (event_id, user_id, role_on_event) SELECT $1, $2, $3
        WHERE NOT EXISTS (SELECT 1 FROM event_assignments WHERE event_id = $1 AND user_id = $2 AND role_on_event = $3 AND removed_at IS NULL)`,
      [eventId, uid, role]
    );
  }
}

async function setLines(tx: Tx, eventId: string, lines: EventLineInput[], previousItemIds: Set<string>) {
  const ids = [...new Set(lines.map((l) => l.itemId))];
  const { rows: items } = await tx.query<{ id: string; status: string }>('SELECT id, status FROM items WHERE id = ANY($1::uuid[])', [ids]);
  for (const l of lines) {
    const it = items.find((i) => i.id === l.itemId);
    if (!it) throw new ApiError('VALIDATION_FAILED', { fields: { lines: 'Unknown item' } });
    if (it.status !== 'active' && !previousItemIds.has(l.itemId)) throw new ApiError('VALIDATION_FAILED', { fields: { lines: 'Archived items cannot be added to events' } });
    const sum = l.sources.reduce((s, x) => s.plus(x.qty), new Decimal(0));
    if (!sum.eq(l.plannedQty)) throw new ApiError('VALIDATION_FAILED', { fields: { lines: 'Each line’s sources must add up to its quantity' } });
  }
  await tx.query('DELETE FROM event_lines WHERE event_id = $1', [eventId]);
  for (const [i, l] of lines.entries()) {
    const { rows } = await tx.query<{ id: string }>('INSERT INTO event_lines (event_id, item_id, planned_qty, position, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [eventId, l.itemId, l.plannedQty, i, l.notes ?? '']);
    for (const s of l.sources) {
      await tx.query(
        'INSERT INTO event_line_sources (event_line_id, source_type, warehouse_id, source_event_id, planned_qty) VALUES ($1, $2, $3, $4, $5)',
        [rows[0]!.id, s.type, s.type === 'warehouse' ? s.warehouseId : null, s.type === 'event' ? s.eventId : null, s.qty]
      );
    }
  }
}

/** Direct handover (clarification): the source ends before this event leaves and has the item to spare. */
async function checkHandovers(tx: Tx, eventId: string) {
  const { rows } = await tx.query<{ item_id: string; source_event_id: string; qty: string; ok: boolean; planned: string | null; promised: string }>(
    `SELECT el.item_id, s.source_event_id, s.planned_qty::text AS qty,
            (x.status IN ('scheduled', 'dispatching', 'in_transit', 'at_site') AND x.ends_at IS NOT NULL AND e.leave_warehouse_at IS NOT NULL AND x.ends_at <= e.leave_warehouse_at AND x.id <> e.id) AS ok,
            (SELECT sum(planned_qty)::text FROM event_lines WHERE event_id = x.id AND item_id = el.item_id) AS planned,
            COALESCE((SELECT sum(s2.planned_qty) FROM event_line_sources s2 JOIN event_lines l2 ON l2.id = s2.event_line_id JOIN events y ON y.id = l2.event_id
                       WHERE s2.source_event_id = x.id AND l2.item_id = el.item_id AND y.status NOT IN ('draft', 'cancelled') AND y.id <> e.id), 0)::text AS promised
       FROM event_lines el JOIN event_line_sources s ON s.event_line_id = el.id AND s.source_type = 'event'
       JOIN events e ON e.id = el.event_id JOIN events x ON x.id = s.source_event_id
      WHERE el.event_id = $1`,
    [eventId]
  );
  for (const r of rows) {
    const free = new Decimal(r.planned ?? 0).minus(r.promised);
    if (!r.ok || free.lt(r.qty)) throw new ApiError('HANDOVER_NOT_ELIGIBLE', { sourceEventId: r.source_event_id, itemId: r.item_id, freeQty: Decimal.max(free, 0).toFixed(3) });
  }
}

async function writeFields(tx: Tx, id: string, input: EventInput, auth: Authenticated) {
  const phone = input.siteContactPhone === undefined ? undefined : input.siteContactPhone ? normalisePhone(input.siteContactPhone) : null;
  if (input.siteContactPhone && !phone) throw new ApiError('VALIDATION_FAILED', { fields: { siteContactPhone: 'Enter a valid phone number' } });
  const cols: Array<[string, unknown]> = [];
  const map: Record<string, string> = {
    name: 'name', typeId: 'type_id', description: 'description', venueName: 'venue_name', venueAddress: 'venue_address', latitude: 'latitude',
    longitude: 'longitude', placeId: 'place_id', startsAt: 'starts_at', endsAt: 'ends_at', leaveWarehouseAt: 'leave_warehouse_at',
    expectedReturnDate: 'expected_return_date', siteContactName: 'site_contact_name', notes: 'notes'
  };
  for (const [k, col] of Object.entries(map)) {
    const v = (input as Record<string, unknown>)[k];
    if (v !== undefined) cols.push([col, v]);
  }
  if (phone !== undefined) cols.push(['site_contact_phone_e164', phone]);
  cols.push(['updated_by', auth.user.id], ['updated_at', now()]);
  const sets = cols.map(([c], i) => `${c} = $${i + 2}`).join(', ');
  try {
    await tx.query(`UPDATE events SET ${sets} WHERE id = $1`, [id, ...cols.map(([, v]) => v)]);
  } catch (err) {
    if ((err as { code?: string }).code === '23514') throw new ApiError('VALIDATION_FAILED', { fields: { leaveWarehouseAt: 'Check the event dates' } });
    throw err;
  }
}

async function scheduleWithin(tx: Tx, id: string, auth: Authenticated, ctx: RequestContext) {
  const d = await eventDetail(tx, id);
  const missing = missingToSchedule(d);
  if (missing.length) throw new ApiError('EVENT_INCOMPLETE', { missing });
  await tx.query("UPDATE events SET status = 'scheduled', scheduled_at = clock_timestamp() WHERE id = $1", [id]);
  await syncReservations(tx, id, auth.user.id, ctx);
  await followUp(tx, id, d.lines.map((l) => l.itemId), auth.user.id, ctx);
  const recipientIds = await assigneeIds(tx, id);
  await emit(tx, 'event.scheduled', { recordType: 'event', recordId: id, actorUserId: auth.user.id,
    payload: { eventId: id, number: d.number, name: d.name, leaveWarehouseAt: d.leaveWarehouseAt, link: `/events/${id}`, recipientIds } });
}

export async function createEvent(auth: Authenticated, input: EventInput & { schedule?: boolean }, ctx: RequestContext): Promise<EventDetail> {
  return withTransaction(async (tx) => {
    const number = await issueRecordNumber(tx, 'event');
    const { rows } = await tx.query<{ id: string }>('INSERT INTO events (number, created_by, created_at, updated_at) VALUES ($1, $2, $3, $3) RETURNING id', [number, auth.user.id, now()]);
    const id = rows[0]!.id;
    await writeFields(tx, id, input, auth);
    await setPeople(tx, id, 'event_manager', input.eventManagerIds ?? []);
    await setPeople(tx, id, 'store_manager', input.storeManagerIds ?? []);
    await setLines(tx, id, input.lines ?? [], new Set());
    checkDates(await eventDetail(tx, id));
    await checkHandovers(tx, id);
    if (input.schedule) await scheduleWithin(tx, id, auth, ctx);
    const after = await eventDetail(tx, id);
    await writeAudit(tx, { action: 'event.created', actorUserId: auth.user.id, entityType: 'event', entityId: id, after, ctx });
    return after;
  });
}

async function lockEvent(tx: Tx, id: string) {
  const { rows } = await tx.query<{ status: string; version: number }>('SELECT status, version FROM events WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw new ApiError('NOT_FOUND');
  return rows[0];
}

const CHANGE_FIELDS = ['name', 'venueName', 'venueAddress', 'startsAt', 'endsAt', 'leaveWarehouseAt', 'expectedReturnDate', 'siteContactName', 'siteContactPhone'] as const;

function diff(a: EventDetail, b: EventDetail): string[] {
  const out: string[] = CHANGE_FIELDS.filter((k) => a[k] !== b[k]);
  const lines = (d: EventDetail) => JSON.stringify(d.lines.map((l) => [l.itemId, l.plannedQty, l.sources.map((s) => [s.warehouseId, s.eventId, s.qty])]));
  if (lines(a) !== lines(b)) out.push('lines');
  const ids = (x: Array<{ id: string }>) => x.map((p) => p.id).sort().join();
  if (ids(a.eventManagers) !== ids(b.eventManagers)) out.push('eventManagers');
  if (ids(a.storeManagers) !== ids(b.storeManagers)) out.push('storeManagers');
  return out;
}

/** Edits before dispatch; reservations and warnings follow; assignees hear what changed (US3-2, US4-1). */
export async function updateEvent(auth: Authenticated, id: string, ifMatch: string | null, input: EventInput, ctx: RequestContext): Promise<EventDetail> {
  return withTransaction(async (tx) => {
    const locked = await lockEvent(tx, id);
    if (!ifMatch || Number(ifMatch) !== locked.version) throw new ApiError('EVENT_CHANGED', { version: locked.version });
    if (locked.status !== 'draft' && locked.status !== 'scheduled') throw new ApiError('EVENT_STATE', { status: locked.status });
    const before = await eventDetail(tx, id);
    const beforeAssignees = await assigneeIds(tx, id);
    await writeFields(tx, id, input, auth);
    if (input.eventManagerIds) await setPeople(tx, id, 'event_manager', input.eventManagerIds);
    if (input.storeManagerIds) await setPeople(tx, id, 'store_manager', input.storeManagerIds);
    if (input.lines) await setLines(tx, id, input.lines, new Set(before.lines.map((l) => l.itemId)));
    await tx.query('UPDATE events SET version = version + 1 WHERE id = $1', [id]);
    const mid = await eventDetail(tx, id);
    checkDates(mid);
    await checkHandovers(tx, id);
    if (locked.status === 'scheduled') {
      const missing = missingToSchedule(mid);
      if (missing.length) throw new ApiError('EVENT_INCOMPLETE', { missing });
      await syncReservations(tx, id, auth.user.id, ctx);
      const items = [...new Set([...before.lines, ...mid.lines].map((l) => l.itemId))];
      await followUp(tx, id, items, auth.user.id, ctx);
      const changes = diff(before, mid);
      const nowAssignees = await assigneeIds(tx, id);
      const removed = beforeAssignees.filter((u) => !nowAssignees.includes(u));
      const base = { eventId: id, number: mid.number, name: mid.name, link: `/events/${id}` };
      if (changes.length && nowAssignees.length) {
        await emit(tx, 'event.changed', { recordType: 'event', recordId: id, actorUserId: auth.user.id, payload: { ...base, changes, recipientIds: nowAssignees } });
      }
      if (removed.length) await emit(tx, 'event.unassigned', { recordType: 'event', recordId: id, actorUserId: auth.user.id, payload: { ...base, recipientIds: removed } });
    }
    const after = await eventDetail(tx, id);
    await writeAudit(tx, { action: 'event.updated', actorUserId: auth.user.id, entityType: 'event', entityId: id, before, after, ctx });
    return after;
  });
}

export async function scheduleEvent(auth: Authenticated, id: string, ctx: RequestContext): Promise<EventDetail> {
  return withTransaction(async (tx) => {
    const locked = await lockEvent(tx, id);
    if (locked.status !== 'draft') throw new ApiError('EVENT_STATE', { status: locked.status });
    const before = await eventDetail(tx, id);
    checkDates(before);
    await checkHandovers(tx, id);
    await scheduleWithin(tx, id, auth, ctx);
    await tx.query('UPDATE events SET version = version + 1 WHERE id = $1', [id]);
    const after = await eventDetail(tx, id);
    await writeAudit(tx, { action: 'event.scheduled', actorUserId: auth.user.id, entityType: 'event', entityId: id, before, after, ctx });
    return after;
  });
}

/** Cancel before dispatch only; releases everything and tells the assignees (US4-2, US4-3). */
export async function cancelEvent(auth: Authenticated, id: string, reason: string, ctx: RequestContext): Promise<EventDetail> {
  return withTransaction(async (tx) => {
    const locked = await lockEvent(tx, id);
    if (locked.status !== 'draft' && locked.status !== 'scheduled') throw new ApiError('EVENT_STATE', { status: locked.status }, 'Only Draft or Scheduled events can be cancelled; items must come back through the checklist.');
    const before = await eventDetail(tx, id);
    await tx.query("UPDATE events SET status = 'cancelled', cancelled_reason = $2, cancelled_by = $3, cancelled_at = $4, version = version + 1 WHERE id = $1", [id, reason, auth.user.id, now()]);
    await syncReservations(tx, id, auth.user.id, ctx);
    await followUp(tx, id, before.lines.map((l) => l.itemId), auth.user.id, ctx);
    if (locked.status === 'scheduled') {
      const recipientIds = await assigneeIds(tx, id);
      if (recipientIds.length) {
        await emit(tx, 'event.cancelled', { recordType: 'event', recordId: id, actorUserId: auth.user.id,
          payload: { eventId: id, number: before.number, name: before.name, reason, link: `/events/${id}`, recipientIds } });
      }
    }
    const after = await eventDetail(tx, id);
    await writeAudit(tx, { action: 'event.cancelled', actorUserId: auth.user.id, entityType: 'event', entityId: id, before, after, ctx });
    return after;
  });
}

/** Copy as a Draft: same items, quantities, sources and managers; no dates (US4-4). */
export async function copyEvent(auth: Authenticated, id: string, ctx: RequestContext): Promise<EventDetail> {
  const src = await eventDetail(getPool(), id);
  return createEvent(auth, {
    name: src.name, typeId: src.typeId, description: src.description, venueName: src.venueName, venueAddress: src.venueAddress,
    latitude: src.latitude, longitude: src.longitude, siteContactName: src.siteContactName, siteContactPhone: src.siteContactPhone, notes: src.notes,
    eventManagerIds: src.eventManagers.map((m) => m.id), storeManagerIds: src.storeManagers.map((m) => m.id),
    lines: src.lines.map((l) => ({
      itemId: l.itemId, plannedQty: l.plannedQty, notes: l.notes,
      sources: l.sources.filter((s) => s.type === 'warehouse').length === l.sources.length
        ? l.sources.map((s) => ({ type: 'warehouse' as const, warehouseId: s.warehouseId!, qty: s.qty }))
        : [{ type: 'warehouse' as const, warehouseId: l.sources.find((s) => s.warehouseId)?.warehouseId ?? '', qty: l.plannedQty }]
    })).filter((l) => l.sources.every((s) => s.warehouseId))
  }, ctx);
}
