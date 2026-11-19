import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import { emit } from '../notifications/outbox';
import { requireWarehouseScope } from '../auth/guards';
import { hasPermission } from '@artoholic/shared';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';
import { postMovements } from './post';
import { toItemUnit } from '../catalogue/units';
import { warehouseOfLocation } from '../warehouses/basic';
import { now } from '../auth/clock';

type Tx = Pick<PoolClient, 'query'>;

async function itemInfo(db: Tx, itemId: string) {
  const { rows } = await db.query<{ tracking_type: string; unit_code: string | null; code: string; status: string }>(
    `SELECT i.tracking_type, i.unit_code, c.code::text, i.status FROM items i JOIN item_codes c ON c.item_id = i.id AND c.active_to IS NULL WHERE i.id = $1`,
    [itemId]
  );
  if (!rows[0]) throw new ApiError('NOT_FOUND', { itemId });
  return rows[0];
}

async function scopeLocation(auth: Authenticated, locationId: string) {
  await requireWarehouseScope(auth, await warehouseOfLocation(locationId));
}

/** Creates the next piece number for a cut product: ITM-00001-P1, -P2… (research R5). */
async function newPiece(tx: Tx, itemId: string, code: string, length: string, parent?: { id: string; number: string }) {
  let number: string;
  if (parent) {
    const { rows } = await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM item_pieces WHERE parent_piece_id = $1', [parent.id]);
    number = `${parent.number}.${rows[0]!.n + 1}`;
  } else {
    const { rows } = await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM item_pieces WHERE item_id = $1 AND parent_piece_id IS NULL', [itemId]);
    number = `${code}-P${rows[0]!.n + 1}`;
  }
  const { rows } = await tx.query<{ id: string }>(
    'INSERT INTO item_pieces (item_id, piece_number, original_length, parent_piece_id) VALUES ($1, $2, $3, $4) RETURNING id',
    [itemId, number, length, parent?.id ?? null]
  );
  return { id: rows[0]!.id, number };
}

export interface OpeningLine { itemId: string; locationId: string; condition: 'available' | 'damaged'; quantity: string; unit?: string }

/** Opening stock (003 FR-004). For cut products each line is one roll/piece. */
export async function postOpening(tx: Tx, auth: Authenticated, lines: OpeningLine[], ref: { type: string; id: string } | undefined, ctx: RequestContext): Promise<number> {
  const movements = [];
  for (const line of lines) {
    const info = await itemInfo(tx, line.itemId);
    const quantity = await toItemUnit(tx, info.unit_code, line.quantity, line.unit);
    let pieceId: string | null = null;
    if (info.tracking_type === 'cut') pieceId = (await newPiece(tx, line.itemId, info.code, quantity)).id;
    movements.push({ type: 'opening' as const, itemId: line.itemId, quantity, pieceId, to: { locationId: line.locationId, condition: line.condition }, reference: ref, reason: 'Opening stock' });
  }
  await postMovements(tx, movements, { actorUserId: auth.user.id, ctx });
  await writeAudit(tx, { action: 'stock.opening_posted', actorUserId: auth.user.id, entityType: ref?.type ?? 'stock', entityId: ref?.id, after: { lines: lines.length }, ctx });
  return movements.length;
}

export async function openingStock(auth: Authenticated, lines: OpeningLine[], ctx: RequestContext) {
  for (const l of lines) await scopeLocation(auth, l.locationId);
  return withTransaction((tx) => postOpening(tx, auth, lines, undefined, ctx));
}

/** Cut a length from a piece; the offcut stays in stock for reuse (003 FR-006, owner decision Q2). */
export async function cutPiece(auth: Authenticated, pieceId: string, length: string, unit: string | undefined, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ item_id: string; piece_number: string; location_id: string | null; condition: string; quantity: string }>(
      `SELECT p.item_id, p.piece_number, b.location_id, b.condition, b.quantity::text
         FROM item_pieces p JOIN stock_balances b ON b.piece_id = p.id AND b.quantity > 0 AND b.condition IN ('available', 'damaged')
        WHERE p.id = $1 AND p.status = 'active'`,
      [pieceId]
    );
    const at = rows[0];
    if (!at || !at.location_id) throw new ApiError('NOT_FOUND', { pieceId }, 'That piece is not in a warehouse.');
    await scopeLocation(auth, at.location_id);
    const info = await itemInfo(tx, at.item_id);
    const len = await toItemUnit(tx, info.unit_code, length, unit);
    const remaining = new Decimal(at.quantity).sub(len);
    if (remaining.lte(0)) throw new ApiError('INSUFFICIENT_STOCK', { pieceId, available: at.quantity }, `The piece is only ${at.quantity} ${info.unit_code} long.`);
    const child = await newPiece(tx, at.item_id, info.code, len, { id: pieceId, number: at.piece_number });
    await postMovements(tx, [{
      type: 'cut', itemId: at.item_id, quantity: len, fromPieceId: pieceId, toPieceId: child.id,
      from: { locationId: at.location_id, condition: at.condition as 'available' }, to: { locationId: at.location_id, condition: at.condition as 'available' },
      reason: `Cut ${len} ${info.unit_code} from ${at.piece_number}`
    }], { actorUserId: auth.user.id, ctx });
    await writeAudit(tx, { action: 'stock.cut', actorUserId: auth.user.id, entityType: 'item_piece', entityId: pieceId, after: { cut: len, piece: child.number }, ctx });
    return { cutPiece: { id: child.id, pieceNumber: child.number, length: new Decimal(len).toFixed(3) }, offcut: { id: pieceId, pieceNumber: at.piece_number, length: remaining.toFixed(3) } };
  });
}

interface RequestRow { id: string; kind: 'correction' | 'write_off'; item_id: string; piece_id: string | null; location_id: string | null; condition: 'available' | 'damaged'; quantity_change: string; reason: string; status: string }

/** Movement for an approved correction or write-off (signed change on one bin and condition). */
function movementFor(r: RequestRow) {
  const qd = new Decimal(r.quantity_change);
  const quantity = qd.abs().toFixed(3);
  const bin = { locationId: r.location_id, condition: r.condition };
  if (r.kind === 'write_off') return { type: 'write_off' as const, itemId: r.item_id, pieceId: r.piece_id, quantity, from: bin, to: { condition: 'written_off' as const }, reason: r.reason, reference: { type: 'correction_request', id: r.id } };
  return qd.isNeg()
    ? { type: 'adjustment' as const, itemId: r.item_id, pieceId: r.piece_id, quantity, from: bin, to: { condition: 'lost' as const }, reason: r.reason, reference: { type: 'correction_request', id: r.id } }
    : { type: 'adjustment' as const, itemId: r.item_id, pieceId: r.piece_id, quantity, to: bin, reason: r.reason, reference: { type: 'correction_request', id: r.id } };
}

async function insertRequest(tx: Tx, auth: Authenticated, r: Omit<RequestRow, 'id' | 'status'>): Promise<RequestRow> {
  const { rows } = await tx.query<RequestRow>(
    `INSERT INTO correction_requests (kind, item_id, piece_id, location_id, condition, quantity_change, reason, requested_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, kind, item_id, piece_id, location_id, condition, quantity_change::text, reason, status`,
    [r.kind, r.item_id, r.piece_id, r.location_id, r.condition, r.quantity_change, r.reason, auth.user.id]
  );
  return rows[0]!;
}

async function decide(tx: Tx, auth: Authenticated, row: RequestRow, approved: boolean, note: string | undefined, ctx: RequestContext) {
  let movementId: number | null = null;
  if (approved) movementId = (await postMovements(tx, [movementFor(row)], { actorUserId: auth.user.id, ctx }))[0] ?? null;
  await tx.query('UPDATE correction_requests SET status = $2, decided_by = $3, decided_at = $4, decision_note = $5, movement_id = $6 WHERE id = $1',
    [row.id, approved ? 'approved' : 'rejected', auth.user.id, now(), note ?? null, movementId]);
  await writeAudit(tx, { action: approved ? 'stock.request_approved' : 'stock.request_rejected', actorUserId: auth.user.id, entityType: 'correction_request', entityId: row.id, after: { note }, ctx });
  return { ...row, status: approved ? 'approved' : 'rejected', movementId };
}

/**
 * Manual correction (clarification): a Store Manager's request waits for an Admin; an Admin's own
 * correction applies at once. Both need a reason.
 */
export async function requestCorrection(auth: Authenticated, input: { itemId: string; pieceId?: string; locationId: string; condition: 'available' | 'damaged'; quantityChange: string; unit?: string; reason: string }, ctx: RequestContext) {
  await scopeLocation(auth, input.locationId);
  return withTransaction(async (tx) => {
    const info = await itemInfo(tx, input.itemId);
    const negative = input.quantityChange.startsWith('-');
    const magnitude = await toItemUnit(tx, info.unit_code, negative ? input.quantityChange.slice(1) : input.quantityChange, input.unit);
    const row = await insertRequest(tx, auth, { kind: 'correction', item_id: input.itemId, piece_id: input.pieceId ?? null, location_id: input.locationId, condition: input.condition, quantity_change: `${negative ? '-' : ''}${magnitude}`, reason: input.reason });
    if (hasPermission(auth.user.roles, 'stock.approve')) return { applied: true, request: await decide(tx, auth, row, true, 'Applied directly by an Admin', ctx) };
    await emit(tx, 'stock.request_pending', { recordType: 'correction_request', recordId: row.id, actorUserId: auth.user.id, payload: { kind: 'correction', itemId: input.itemId } });
    await writeAudit(tx, { action: 'stock.correction_requested', actorUserId: auth.user.id, entityType: 'correction_request', entityId: row.id, after: input, ctx });
    return { applied: false, request: row };
  });
}

/** Write-offs always need an Admin's approval (003 FR-009). */
export async function requestWriteOff(auth: Authenticated, input: { itemId: string; pieceId?: string; locationId: string; quantity: string; reason: string }, ctx: RequestContext) {
  await scopeLocation(auth, input.locationId);
  return withTransaction(async (tx) => {
    const row = await insertRequest(tx, auth, { kind: 'write_off', item_id: input.itemId, piece_id: input.pieceId ?? null, location_id: input.locationId, condition: 'damaged', quantity_change: `-${input.quantity}`, reason: input.reason });
    await emit(tx, 'stock.request_pending', { recordType: 'correction_request', recordId: row.id, actorUserId: auth.user.id, payload: { kind: 'write_off', itemId: input.itemId } });
    await writeAudit(tx, { action: 'stock.write_off_requested', actorUserId: auth.user.id, entityType: 'correction_request', entityId: row.id, after: input, ctx });
    return row;
  });
}

export async function decideRequest(auth: Authenticated, id: string, approved: boolean, note: string | undefined, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<RequestRow>('SELECT id, kind, item_id, piece_id, location_id, condition, quantity_change::text, reason, status FROM correction_requests WHERE id = $1 FOR UPDATE', [id]);
    const row = rows[0];
    if (!row) throw new ApiError('NOT_FOUND');
    if (row.status !== 'pending') throw new ApiError('REQUEST_DECIDED');
    return decide(tx, auth, row, approved, note, ctx);
  });
}

/** Damaged stock that turns out usable goes back to Available with a reason (003 US6-2). */
export async function returnToAvailable(auth: Authenticated, input: { itemId: string; pieceId?: string; locationId: string; quantity: string; reason: string }, ctx: RequestContext) {
  await scopeLocation(auth, input.locationId);
  return withTransaction(async (tx) => {
    const [id] = await postMovements(tx, [{ type: 'repair_ok', itemId: input.itemId, pieceId: input.pieceId ?? null, quantity: input.quantity, from: { locationId: input.locationId, condition: 'damaged' }, to: { locationId: input.locationId, condition: 'available' }, reason: input.reason }], { actorUserId: auth.user.id, ctx });
    await writeAudit(tx, { action: 'stock.returned_to_available', actorUserId: auth.user.id, entityType: 'item', entityId: input.itemId, after: input, ctx });
    return { movementId: id };
  });
}

export async function listRequests(status: string | undefined) {
  const { rows } = await getPool().query(
    `SELECT r.id, r.kind, r.item_id, i.name AS item_name, l.code AS location_code, r.condition, r.quantity_change::text, r.reason,
            u.full_name AS requested_by, r.requested_at, r.status, r.movement_id
       FROM correction_requests r JOIN items i ON i.id = r.item_id LEFT JOIN locations l ON l.id = r.location_id JOIN users u ON u.id = r.requested_by
      WHERE ($1::text IS NULL OR r.status = $1) ORDER BY r.requested_at DESC LIMIT 200`,
    [status ?? null]
  );
  return rows.map((r) => ({
    id: r.id, kind: r.kind, itemId: r.item_id, itemName: r.item_name, locationCode: r.location_code, condition: r.condition, quantityChange: r.quantity_change,
    reason: r.reason, requestedBy: r.requested_by, requestedAt: (r.requested_at as Date).toISOString(), status: r.status, movementId: r.movement_id ? Number(r.movement_id) : null
  }));
}

export async function listMovements(q: { itemId?: string; locationId?: string; type?: string; cursor?: number }) {
  const { rows } = await getPool().query(
    `SELECT m.id, m.type, m.item_id, m.quantity::text, m.from_condition, m.to_condition, fl.code AS from_location, tl.code AS to_location,
            m.reference_type, m.reference_id, m.reason, u.full_name AS actor, m.occurred_at
       FROM stock_movements m LEFT JOIN locations fl ON fl.id = m.from_location_id LEFT JOIN locations tl ON tl.id = m.to_location_id
       LEFT JOIN users u ON u.id = m.actor_user_id
      WHERE ($1::uuid IS NULL OR m.item_id = $1) AND ($2::uuid IS NULL OR m.from_location_id = $2 OR m.to_location_id = $2)
        AND ($3::movement_type IS NULL OR m.type = $3) AND ($4::bigint IS NULL OR m.id < $4)
      ORDER BY m.id DESC LIMIT 100`,
    [q.itemId ?? null, q.locationId ?? null, q.type ?? null, q.cursor ?? null]
  );
  return { items: rows.map((r) => ({ ...r, id: Number(r.id), occurredAt: (r.occurred_at as Date).toISOString() })), nextCursor: rows.length === 100 ? String(rows.at(-1)!.id) : null };
}
