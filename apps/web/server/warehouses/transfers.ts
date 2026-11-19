import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import type { Transfer } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import { requireWarehouseScope } from '../auth/guards';
import { now } from '../auth/clock';
import { issueRecordNumber } from '../sequences/issue';
import { postMovements, type MovementInput } from '../stock/post';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';

type Tx = Pick<PoolClient, 'query'>;
const q3 = (v: string | null) => (v === null ? null : new Decimal(v).toFixed(3));

async function locationIn(tx: Tx, locationId: string, warehouseId: string): Promise<void> {
  const { rows } = await tx.query<{ warehouse_id: string }>('SELECT warehouse_id FROM locations WHERE id = $1', [locationId]);
  if (!rows[0]) throw new ApiError('NOT_FOUND', { locationId });
  if (rows[0].warehouse_id !== warehouseId) throw new ApiError('VALIDATION_FAILED', { fields: { locationId: 'Pick a location in this warehouse' } });
}

/** Move within one warehouse: one ledger entry (004 FR-008). */
export async function moveStock(
  auth: Authenticated,
  input: { itemId: string; pieceId?: string; fromLocationId: string; toLocationId: string; quantity: string; condition: 'available' | 'damaged' },
  ctx: RequestContext
): Promise<{ movementId: number }> {
  const { rows } = await getPool().query<{ id: string; warehouse_id: string }>('SELECT id, warehouse_id FROM locations WHERE id = ANY($1::uuid[])', [[input.fromLocationId, input.toLocationId]]);
  const from = rows.find((r) => r.id === input.fromLocationId);
  const to = rows.find((r) => r.id === input.toLocationId);
  if (!from || !to) throw new ApiError('NOT_FOUND');
  if (from.warehouse_id !== to.warehouse_id) throw new ApiError('VALIDATION_FAILED', { fields: { toLocationId: 'Use a transfer to move stock between warehouses' } });
  if (from.id === to.id) throw new ApiError('VALIDATION_FAILED', { fields: { toLocationId: 'Pick a different location' } });
  await requireWarehouseScope(auth, from.warehouse_id);
  return withTransaction(async (tx) => {
    const [id] = await postMovements(tx, [{
      type: 'move', itemId: input.itemId, pieceId: input.pieceId ?? null, quantity: input.quantity,
      from: { locationId: from.id, condition: input.condition }, to: { locationId: to.id, condition: input.condition }
    }], { actorUserId: auth.user.id, ctx });
    await writeAudit(tx, { action: 'stock.moved', actorUserId: auth.user.id, entityType: 'item', entityId: input.itemId, after: input, ctx });
    return { movementId: id! };
  });
}

export async function transferDetail(db: Tx, id: string): Promise<Transfer> {
  const { rows } = await db.query(
    `SELECT t.id, t.number, t.from_warehouse_id, fw.code AS from_code, t.to_warehouse_id, tw.code AS to_code, t.status, t.notes, t.requested_at
       FROM transfers t JOIN warehouses fw ON fw.id = t.from_warehouse_id JOIN warehouses tw ON tw.id = t.to_warehouse_id WHERE t.id = $1`,
    [id]
  );
  const t = rows[0];
  if (!t) throw new ApiError('NOT_FOUND');
  const lines = await db.query(
    `SELECT l.id, l.item_id, i.name, l.piece_id, l.requested_qty::text, l.dispatched_qty::text, l.received_qty::text, l.missing_qty::text, l.shortfall_decision
       FROM transfer_lines l JOIN items i ON i.id = l.item_id WHERE l.transfer_id = $1 ORDER BY i.name, l.id`,
    [id]
  );
  return {
    id: t.id, number: t.number, fromWarehouseId: t.from_warehouse_id, fromWarehouseCode: t.from_code, toWarehouseId: t.to_warehouse_id,
    toWarehouseCode: t.to_code, status: t.status, notes: t.notes, requestedAt: new Date(t.requested_at).toISOString(),
    lines: lines.rows.map((l) => ({
      id: l.id, itemId: l.item_id, itemName: l.name, pieceId: l.piece_id, requestedQty: q3(l.requested_qty)!, dispatchedQty: q3(l.dispatched_qty),
      receivedQty: q3(l.received_qty), missingQty: q3(l.missing_qty), shortfallDecision: l.shortfall_decision
    }))
  };
}

export async function listTransfers(auth: Authenticated, filter: { status?: string }) {
  const admin = auth.user.roles.includes('admin') || auth.user.roles.includes('super_admin');
  const { rows } = await getPool().query(
    `SELECT t.id, t.number, t.status, fw.code AS from_code, tw.code AS to_code, t.requested_at,
            (SELECT count(*)::int FROM transfer_lines l WHERE l.transfer_id = t.id) AS line_count,
            EXISTS (SELECT 1 FROM transfer_lines l WHERE l.transfer_id = t.id AND l.shortfall_decision = 'pending') AS shortfall_pending
       FROM transfers t JOIN warehouses fw ON fw.id = t.from_warehouse_id JOIN warehouses tw ON tw.id = t.to_warehouse_id
      WHERE ($1::text IS NULL OR t.status = $1)
        AND ($2::boolean OR EXISTS (SELECT 1 FROM warehouse_assignments a WHERE a.user_id = $3 AND a.unassigned_at IS NULL AND a.warehouse_id IN (t.from_warehouse_id, t.to_warehouse_id)))
      ORDER BY t.requested_at DESC LIMIT 200`,
    [filter.status ?? null, admin, auth.user.id]
  );
  return rows.map((r) => ({
    id: r.id, number: r.number, status: r.status, fromWarehouseCode: r.from_code, toWarehouseCode: r.to_code,
    requestedAt: new Date(r.requested_at).toISOString(), lineCount: r.line_count, shortfallPending: r.shortfall_pending
  }));
}

export async function getTransfer(auth: Authenticated, id: string): Promise<Transfer> {
  const t = await transferDetail(getPool(), id);
  try {
    await requireWarehouseScope(auth, t.fromWarehouseId);
  } catch {
    await requireWarehouseScope(auth, t.toWarehouseId);
  }
  return t;
}

export async function createTransfer(
  auth: Authenticated,
  input: { fromWarehouseId: string; toWarehouseId: string; notes?: string; lines: Array<{ itemId: string; pieceId?: string; quantity: string }> },
  ctx: RequestContext
): Promise<Transfer> {
  if (input.fromWarehouseId === input.toWarehouseId) throw new ApiError('VALIDATION_FAILED', { fields: { toWarehouseId: 'Pick a different warehouse' } });
  try {
    await requireWarehouseScope(auth, input.fromWarehouseId);
  } catch {
    await requireWarehouseScope(auth, input.toWarehouseId);
  }
  return withTransaction(async (tx) => {
    const { rows } = await tx.query("SELECT id FROM warehouses WHERE id = ANY($1::uuid[]) AND status = 'active'", [[input.fromWarehouseId, input.toWarehouseId]]);
    if (rows.length !== 2) throw new ApiError('VALIDATION_FAILED', { fields: { toWarehouseId: 'Both warehouses must be active' } });
    const number = await issueRecordNumber(tx, 'stock_transfer');
    const t = await tx.query<{ id: string }>(
      'INSERT INTO transfers (number, from_warehouse_id, to_warehouse_id, notes, requested_by, requested_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [number, input.fromWarehouseId, input.toWarehouseId, input.notes ?? '', auth.user.id, now()]
    );
    const id = t.rows[0]!.id;
    for (const l of input.lines) {
      await tx.query('INSERT INTO transfer_lines (transfer_id, item_id, piece_id, requested_qty) VALUES ($1, $2, $3, $4)', [id, l.itemId, l.pieceId ?? null, l.quantity]);
    }
    const after = await transferDetail(tx, id);
    await writeAudit(tx, { action: 'transfer.requested', actorUserId: auth.user.id, entityType: 'transfer', entityId: id, after, ctx });
    return after;
  });
}

async function lockTransfer(tx: Tx, id: string, status: string) {
  const { rows } = await tx.query<{ status: string; from_warehouse_id: string; to_warehouse_id: string }>(
    'SELECT status, from_warehouse_id, to_warehouse_id FROM transfers WHERE id = $1 FOR UPDATE', [id]
  );
  if (!rows[0]) throw new ApiError('NOT_FOUND');
  if (rows[0].status !== status) throw new ApiError('TRANSFER_STATE', { status: rows[0].status }, `This transfer is ${rows[0].status}.`);
  return rows[0];
}

async function linesOf(tx: Tx, id: string) {
  const { rows } = await tx.query<{ id: string; item_id: string; piece_id: string | null; dispatched_qty: string | null; from_location_id: string | null; missing_qty: string | null; shortfall_decision: string | null }>(
    'SELECT id, item_id, piece_id, dispatched_qty::text, from_location_id, missing_qty::text, shortfall_decision FROM transfer_lines WHERE transfer_id = $1', [id]
  );
  return new Map(rows.map((r) => [r.id, r]));
}

/** Source Store Manager dispatches: bin available → in transit for this transfer (FR-010). */
export async function dispatchTransfer(auth: Authenticated, id: string, lines: Array<{ lineId: string; dispatchedQty: string; fromLocationId: string }>, ctx: RequestContext) {
  const { rows } = await getPool().query<{ from_warehouse_id: string }>('SELECT from_warehouse_id FROM transfers WHERE id = $1', [id]);
  if (!rows[0]) throw new ApiError('NOT_FOUND');
  await requireWarehouseScope(auth, rows[0].from_warehouse_id);
  return withTransaction(async (tx) => {
    const t = await lockTransfer(tx, id, 'requested');
    const known = await linesOf(tx, id);
    const moves: MovementInput[] = [];
    for (const l of lines) {
      const line = known.get(l.lineId);
      if (!line) throw new ApiError('VALIDATION_FAILED', { fields: { lineId: 'Unknown line' } });
      await locationIn(tx, l.fromLocationId, t.from_warehouse_id);
      await tx.query('UPDATE transfer_lines SET dispatched_qty = $2, from_location_id = $3 WHERE id = $1', [l.lineId, l.dispatchedQty, l.fromLocationId]);
      if (new Decimal(l.dispatchedQty).gt(0)) {
        moves.push({ type: 'transfer_out', itemId: line.item_id, pieceId: line.piece_id, quantity: l.dispatchedQty,
          from: { locationId: l.fromLocationId, condition: 'available' }, to: { transferId: id, condition: 'in_transit' }, reference: { type: 'transfer', id } });
      }
    }
    await tx.query('UPDATE transfer_lines SET dispatched_qty = 0 WHERE transfer_id = $1 AND dispatched_qty IS NULL', [id]);
    await postMovements(tx, moves, { actorUserId: auth.user.id, ctx });
    await tx.query("UPDATE transfers SET status = 'dispatched', dispatched_by = $2, dispatched_at = $3 WHERE id = $1", [id, auth.user.id, now()]);
    const after = await transferDetail(tx, id);
    await writeAudit(tx, { action: 'transfer.dispatched', actorUserId: auth.user.id, entityType: 'transfer', entityId: id, after, ctx });
    return after;
  });
}

/** Destination receives into bins; a shortfall must be confirmed and then waits for an Admin (FR-011). */
export async function receiveTransfer(auth: Authenticated, id: string, input: { lines: Array<{ lineId: string; receivedQty: string; toLocationId: string }>; confirmMissing?: boolean }, ctx: RequestContext) {
  const { rows } = await getPool().query<{ to_warehouse_id: string }>('SELECT to_warehouse_id FROM transfers WHERE id = $1', [id]);
  if (!rows[0]) throw new ApiError('NOT_FOUND');
  await requireWarehouseScope(auth, rows[0].to_warehouse_id);
  return withTransaction(async (tx) => {
    const t = await lockTransfer(tx, id, 'dispatched');
    const known = await linesOf(tx, id);
    const given = new Map(input.lines.map((l) => [l.lineId, l]));
    const moves: MovementInput[] = [];
    const short: string[] = [];
    for (const [lineId, line] of known) {
      const dispatched = new Decimal(line.dispatched_qty ?? 0);
      if (dispatched.eq(0)) continue;
      const l = given.get(lineId);
      if (!l) throw new ApiError('VALIDATION_FAILED', { fields: { lines: 'Count every dispatched line' } });
      const received = new Decimal(l.receivedQty);
      if (received.gt(dispatched)) throw new ApiError('VALIDATION_FAILED', { fields: { receivedQty: 'More than was dispatched' } });
      await locationIn(tx, l.toLocationId, t.to_warehouse_id);
      const missing = dispatched.minus(received);
      if (missing.gt(0)) short.push(lineId);
      await tx.query(
        'UPDATE transfer_lines SET received_qty = $2, to_location_id = $3, missing_qty = $4, shortfall_decision = $5 WHERE id = $1',
        [lineId, received.toFixed(3), l.toLocationId, missing.toFixed(3), missing.gt(0) ? 'pending' : null]
      );
      if (received.gt(0)) {
        moves.push({ type: 'transfer_in', itemId: line.item_id, pieceId: line.piece_id, quantity: received.toFixed(3),
          from: { transferId: id, condition: 'in_transit' }, to: { locationId: l.toLocationId, condition: 'available' }, reference: { type: 'transfer', id } });
      }
    }
    if (short.length && !input.confirmMissing) {
      throw new ApiError('VALIDATION_FAILED', { fields: { confirmMissing: 'Confirm the missing quantities' }, lines: short });
    }
    await postMovements(tx, moves, { actorUserId: auth.user.id, ctx });
    await tx.query("UPDATE transfers SET status = 'received', received_by = $2, received_at = $3 WHERE id = $1", [id, auth.user.id, now()]);
    const after = await transferDetail(tx, id);
    await writeAudit(tx, { action: 'transfer.received', actorUserId: auth.user.id, entityType: 'transfer', entityId: id, after, ctx });
    return after;
  });
}

/** Admin decides a shortfall: lost, or returned to the source bin (FR-011). */
export async function decideShortfall(auth: Authenticated, id: string, lineId: string, input: { decision: 'lost' | 'returned'; note?: string }, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ item_id: string; piece_id: string | null; missing_qty: string; from_location_id: string; shortfall_decision: string | null }>(
      'SELECT item_id, piece_id, missing_qty::text, from_location_id, shortfall_decision FROM transfer_lines WHERE id = $1 AND transfer_id = $2 FOR UPDATE', [lineId, id]
    );
    const l = rows[0];
    if (!l) throw new ApiError('NOT_FOUND');
    if (l.shortfall_decision !== 'pending') throw new ApiError('TRANSFER_STATE', { decision: l.shortfall_decision }, 'There is no pending shortfall on this line.');
    await postMovements(tx, [{
      type: input.decision === 'lost' ? 'lost' : 'return', itemId: l.item_id, pieceId: l.piece_id, quantity: l.missing_qty,
      from: { transferId: id, condition: 'in_transit' },
      to: input.decision === 'lost' ? { condition: 'lost' } : { locationId: l.from_location_id, condition: 'available' },
      reason: input.note ?? null, reference: { type: 'transfer', id }
    }], { actorUserId: auth.user.id, ctx });
    await tx.query('UPDATE transfer_lines SET shortfall_decision = $2, decided_by = $3, decided_at = $4 WHERE id = $1', [lineId, input.decision, auth.user.id, now()]);
    const after = await transferDetail(tx, id);
    await writeAudit(tx, { action: 'transfer.shortfall_decided', actorUserId: auth.user.id, entityType: 'transfer', entityId: id, after: { lineId, ...input }, ctx });
    return after;
  });
}

export async function cancelTransfer(auth: Authenticated, id: string, ctx: RequestContext) {
  const t = await transferDetail(getPool(), id);
  try {
    await requireWarehouseScope(auth, t.fromWarehouseId);
  } catch {
    await requireWarehouseScope(auth, t.toWarehouseId);
  }
  return withTransaction(async (tx) => {
    await lockTransfer(tx, id, 'requested');
    await tx.query("UPDATE transfers SET status = 'cancelled' WHERE id = $1", [id]);
    await writeAudit(tx, { action: 'transfer.cancelled', actorUserId: auth.user.id, entityType: 'transfer', entityId: id, ctx });
    return transferDetail(tx, id);
  });
}
