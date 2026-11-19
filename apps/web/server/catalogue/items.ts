import type { PoolClient } from 'pg';
import Decimal from 'decimal.js';
import { CONDITIONS, ON_HAND, toQty, type Condition, type Item, type ItemView } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import { issueRecordNumber } from '../sequences/issue';
import { now } from '../auth/clock';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';
import { getStorage } from '../storage';

type Tx = Pick<PoolClient, 'query'>;

const ITEM_SELECT = `
  SELECT i.id, c.code, i.name, i.category_id, cat.name AS category_name, i.description, i.tracking_type, i.unit_code,
         i.replacement_value_paise::text, i.minimum_stock::text, i.minimum_usable_length::text, i.notes, i.status, i.updated_at
    FROM items i
    JOIN item_codes c ON c.item_id = i.id AND c.active_to IS NULL
    JOIN categories cat ON cat.id = i.category_id`;

type ItemRow = {
  id: string; code: string; name: string; category_id: string; category_name: string; description: string; tracking_type: Item['trackingType'];
  unit_code: string | null; replacement_value_paise: string; minimum_stock: string | null; minimum_usable_length: string | null;
  notes: string; status: 'active' | 'archived'; updated_at: Date;
};

const mapItem = (r: ItemRow): Item => ({
  id: r.id, code: r.code, name: r.name, categoryId: r.category_id, categoryName: r.category_name, description: r.description,
  trackingType: r.tracking_type, unitCode: r.unit_code, replacementValuePaise: Number(r.replacement_value_paise),
  minimumStock: r.minimum_stock, minimumUsableLength: r.minimum_usable_length, notes: r.notes, status: r.status, updatedAt: r.updated_at.toISOString()
});

async function loadItem(db: Tx, id: string): Promise<Item> {
  const { rows } = await db.query<ItemRow>(`${ITEM_SELECT} WHERE i.id = $1`, [id]);
  if (!rows[0]) throw new ApiError('NOT_FOUND');
  return mapItem(rows[0]);
}

async function assertCodeFree(tx: Tx, code: string) {
  if ((await tx.query('SELECT 1 FROM item_codes WHERE code = $1', [code])).rowCount) throw new ApiError('CODE_TAKEN', { field: 'code' });
}

async function assertActiveCategory(tx: Tx, id: string) {
  const { rows } = await tx.query<{ status: string }>('SELECT status FROM categories WHERE id = $1', [id]);
  if (!rows[0]) throw new ApiError('VALIDATION_FAILED', { fields: { categoryId: 'Unknown category' } });
  if (rows[0].status !== 'active') throw new ApiError('IN_USE', { categoryId: id }, 'That category is archived.');
}

function assertUnitRule(trackingType: string, unitCode: string | null | undefined) {
  if (trackingType === 'counted' && unitCode) throw new ApiError('VALIDATION_FAILED', { fields: { unitCode: 'Counted items have no unit' } });
  if (trackingType !== 'counted' && !unitCode) throw new ApiError('VALIDATION_FAILED', { fields: { unitCode: 'Choose a unit of measure' } });
}

export interface ItemInput {
  name: string; code?: string; categoryId: string; description?: string; trackingType: Item['trackingType']; unitCode?: string | null;
  replacementValuePaise: number; minimumStock?: string | null; minimumUsableLength?: string | null; notes?: string;
}

export async function createItem(auth: Authenticated, input: ItemInput, ctx: RequestContext, txIn?: Tx): Promise<Item> {
  assertUnitRule(input.trackingType, input.unitCode);
  if (input.trackingType !== 'cut' && input.minimumUsableLength) {
    throw new ApiError('VALIDATION_FAILED', { fields: { minimumUsableLength: 'Only for cut products' } });
  }
  const run = async (tx: Tx) => {
    await assertActiveCategory(tx, input.categoryId);
    if (input.unitCode && !(await tx.query("SELECT 1 FROM units WHERE code = $1 AND status = 'active'", [input.unitCode])).rowCount) {
      throw new ApiError('VALIDATION_FAILED', { fields: { unitCode: 'Unknown unit' } });
    }
    const code = input.code ?? (await issueRecordNumber(tx, 'item'));
    await assertCodeFree(tx, code);
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO items (name, category_id, description, tracking_type, unit_code, replacement_value_paise, minimum_stock, minimum_usable_length, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [input.name, input.categoryId, input.description ?? '', input.trackingType, input.unitCode ?? null, input.replacementValuePaise,
        input.minimumStock ?? null, input.minimumUsableLength ?? null, input.notes ?? '']
    );
    const id = rows[0]!.id;
    await tx.query('INSERT INTO item_codes (code, item_id) VALUES ($1, $2)', [code, id]);
    const item = await loadItem(tx, id);
    await writeAudit(tx, { action: 'item.created', actorUserId: auth.user.id, entityType: 'item', entityId: id, after: item, ctx });
    return item;
  };
  return txIn ? run(txIn) : withTransaction(run);
}

export async function updateItem(
  auth: Authenticated, id: string, ifMatch: string | null,
  input: Partial<Omit<ItemInput, 'trackingType'>> & { status?: 'active' | 'archived' }, ctx: RequestContext
): Promise<Item> {
  return withTransaction(async (tx) => {
    await tx.query('SELECT 1 FROM items WHERE id = $1 FOR UPDATE', [id]);
    const before = await loadItem(tx, id);
    if (!ifMatch || new Date(ifMatch).getTime() !== new Date(before.updatedAt).getTime()) throw new ApiError('STALE_VERSION', { updatedAt: before.updatedAt });
    if (input.unitCode !== undefined && input.unitCode !== before.unitCode) {
      if ((await tx.query('SELECT 1 FROM stock_movements WHERE item_id = $1 LIMIT 1', [id])).rowCount) throw new ApiError('TRACKING_TYPE_LOCKED');
      assertUnitRule(before.trackingType, input.unitCode);
    }
    if (input.categoryId && input.categoryId !== before.categoryId) await assertActiveCategory(tx, input.categoryId);
    if (input.code && input.code !== before.code) {
      await assertCodeFree(tx, input.code);
      await tx.query('UPDATE item_codes SET active_to = $2 WHERE item_id = $1 AND active_to IS NULL', [id, now()]);
      await tx.query('INSERT INTO item_codes (code, item_id) VALUES ($1, $2)', [input.code, id]);
    }
    await tx.query(
      `UPDATE items SET name = COALESCE($2, name), category_id = COALESCE($3, category_id), description = COALESCE($4, description),
         unit_code = CASE WHEN $5::boolean THEN $6 ELSE unit_code END, replacement_value_paise = COALESCE($7, replacement_value_paise),
         minimum_stock = CASE WHEN $8::boolean THEN $9::numeric ELSE minimum_stock END,
         minimum_usable_length = CASE WHEN $10::boolean THEN $11::numeric ELSE minimum_usable_length END,
         notes = COALESCE($12, notes), status = COALESCE($13::item_status, status), updated_at = $14
       WHERE id = $1`,
      [id, input.name ?? null, input.categoryId ?? null, input.description ?? null, input.unitCode !== undefined, input.unitCode ?? null,
        input.replacementValuePaise ?? null, input.minimumStock !== undefined, input.minimumStock ?? null,
        input.minimumUsableLength !== undefined, input.minimumUsableLength ?? null, input.notes ?? null, input.status ?? null, now()]
    );
    const after = await loadItem(tx, id);
    await writeAudit(tx, { action: input.code && input.code !== before.code ? 'item.code_changed' : 'item.updated', actorUserId: auth.user.id, entityType: 'item', entityId: id, before, after, ctx });
    return after;
  });
}

export interface ItemQuery { q?: string; categoryId?: string; warehouseId?: string; condition?: Condition; belowMinimum?: boolean; status?: 'active' | 'archived'; cursor?: number }

/** Search by name and by any code an item has ever had (003 FR-010). */
export async function listItems(query: ItemQuery) {
  const limit = 50;
  const offset = query.cursor ?? 0;
  const q = query.q?.trim() || null;
  const { rows } = await getPool().query<ItemRow & { available: string; on_hand: string }>(
    `${ITEM_SELECT.replace('i.status, i.updated_at', 'i.status, i.updated_at, s.available, s.on_hand')},
       LATERAL (SELECT COALESCE(sum(b.quantity) FILTER (WHERE b.condition = 'available'), 0)::numeric(14,3)::text AS available,
                       COALESCE(sum(b.quantity) FILTER (WHERE b.condition = ANY($7::stock_condition[])), 0)::numeric(14,3)::text AS on_hand
                  FROM stock_balances b LEFT JOIN locations l ON l.id = b.location_id
                 WHERE b.item_id = i.id AND ($3::uuid IS NULL OR l.warehouse_id = $3)) s
     WHERE ($1::text IS NULL OR i.name ILIKE '%' || $1 || '%' OR EXISTS (SELECT 1 FROM item_codes x WHERE x.item_id = i.id AND x.code ILIKE '%' || $1 || '%'))
       AND ($2::uuid IS NULL OR i.category_id = $2 OR cat.parent_id = $2)
       AND ($4::stock_condition IS NULL OR EXISTS (SELECT 1 FROM stock_balances b2 LEFT JOIN locations l2 ON l2.id = b2.location_id
              WHERE b2.item_id = i.id AND b2.condition = $4 AND b2.quantity > 0 AND ($3::uuid IS NULL OR l2.warehouse_id = $3)))
       AND (NOT $5::boolean OR (i.minimum_stock IS NOT NULL AND s.available::numeric < i.minimum_stock))
       AND i.status = COALESCE($6::item_status, 'active')
     ORDER BY i.name, i.id LIMIT ${limit + 1} OFFSET $8`,
    [q, query.categoryId ?? null, query.warehouseId ?? null, query.condition ?? null, query.belowMinimum ?? false, query.status ?? null, ON_HAND, offset]
  );
  return {
    items: rows.slice(0, limit).map((r) => ({ ...mapItem(r), available: r.available, onHand: r.on_hand })),
    nextCursor: rows.length > limit ? String(offset + limit) : null
  };
}

/** Everything about one item (003 US5): balances (scoped for Store Managers), pieces, damage, history. */
export async function itemView(auth: Authenticated, id: string): Promise<ItemView> {
  const db = getPool();
  const item = await loadItem(db, id);
  const scoped = !auth.user.roles.some((r) => r === 'admin' || r === 'super_admin' || r === 'event_manager');
  const scope = scoped ? auth.user.id : null;
  const inScope = `($2::uuid IS NULL OR l.warehouse_id IN (SELECT warehouse_id FROM warehouse_assignments WHERE user_id = $2 AND unassigned_at IS NULL))`;

  const [codes, photos, balances, pieces, last, damage, history] = await Promise.all([
    db.query<{ code: string; active_from: Date; active_to: Date | null }>('SELECT code::text, active_from, active_to FROM item_codes WHERE item_id = $1 ORDER BY active_from', [id]),
    db.query<{ id: string; storage_key: string; position: number }>('SELECT id, storage_key, position FROM item_photos WHERE item_id = $1 ORDER BY position', [id]),
    db.query<{ warehouse_code: string | null; location_code: string | null; location_id: string | null; event_id: string | null; piece_number: string | null; piece_id: string | null; condition: Condition; quantity: string }>(
      `SELECT w.code AS warehouse_code, l.code AS location_code, b.location_id, b.event_id, p.piece_number, b.piece_id, b.condition, b.quantity::text
         FROM stock_balances b LEFT JOIN locations l ON l.id = b.location_id LEFT JOIN warehouses w ON w.id = l.warehouse_id
         LEFT JOIN item_pieces p ON p.id = b.piece_id
        WHERE b.item_id = $1 AND b.quantity > 0 AND (b.location_id IS NULL AND $2::uuid IS NULL OR b.location_id IS NOT NULL AND ${inScope})
        ORDER BY w.code NULLS LAST, l.code, b.condition`,
      [id, scope]
    ),
    db.query<{ id: string; piece_number: string; original_length: string; status: string; current: string | null; location_code: string | null; condition: string | null }>(
      `SELECT p.id, p.piece_number, p.original_length::text, p.status,
              (SELECT sum(quantity)::numeric(14,3)::text FROM stock_balances b WHERE b.piece_id = p.id AND b.condition = ANY($2::stock_condition[])) AS current,
              (SELECT l.code FROM stock_balances b JOIN locations l ON l.id = b.location_id WHERE b.piece_id = p.id AND b.quantity > 0 LIMIT 1) AS location_code,
              (SELECT b.condition::text FROM stock_balances b WHERE b.piece_id = p.id AND b.quantity > 0 AND b.condition = ANY($2::stock_condition[]) LIMIT 1) AS condition
         FROM item_pieces p WHERE p.item_id = $1 AND p.status = 'active' ORDER BY p.piece_number`,
      [id, ON_HAND]
    ),
    db.query<{ ref: string; occurred_at: Date }>("SELECT reference_id AS ref, occurred_at FROM stock_movements WHERE item_id = $1 AND type = 'dispatch' AND reference_type = 'event' ORDER BY id DESC LIMIT 1", [id]),
    db.query<{ damaged_to_date: string; written_off: string; lost: string }>(
      `SELECT COALESCE(sum(quantity) FILTER (WHERE to_condition = 'damaged' AND (from_condition IS DISTINCT FROM 'damaged')), 0)::numeric(14,3)::text AS damaged_to_date,
              COALESCE(sum(quantity) FILTER (WHERE to_condition = 'written_off'), 0)::numeric(14,3)::text AS written_off,
              (COALESCE(sum(quantity) FILTER (WHERE to_condition = 'lost'), 0) - COALESCE(sum(quantity) FILTER (WHERE from_condition = 'lost'), 0))::numeric(14,3)::text AS lost
         FROM stock_movements WHERE item_id = $1`,
      [id]
    ),
    db.query<{ id: string; type: string; quantity: string; occurred_at: Date; reason: string | null; from_condition: string | null; to_condition: string | null; reference_type: string | null; reference_id: string | null; actor: string | null }>(
      `SELECT m.id, m.type, m.quantity::text, m.occurred_at, m.reason, m.from_condition, m.to_condition, m.reference_type, m.reference_id, u.full_name AS actor
         FROM stock_movements m LEFT JOIN users u ON u.id = m.actor_user_id WHERE m.item_id = $1 ORDER BY m.id DESC LIMIT 200`,
      [id]
    )
  ]);

  const totals = Object.fromEntries(CONDITIONS.map((c) => [c, new Decimal(0)])) as Record<Condition, Decimal>;
  const allBalances = await db.query<{ condition: Condition; q: string }>('SELECT condition, sum(quantity)::text AS q FROM stock_balances WHERE item_id = $1 GROUP BY condition', [id]);
  for (const b of allBalances.rows) totals[b.condition] = new Decimal(b.q);
  const onHand = ON_HAND.reduce((s, c) => s.add(totals[c]), new Decimal(0));
  const storage = getStorage();
  const reservations = await db.query<{ event_id: string; q: string }>(
    "SELECT event_id, sum(quantity)::numeric(14,3)::text AS q FROM stock_balances WHERE item_id = $1 AND condition = 'reserved' AND event_id IS NOT NULL AND quantity > 0 GROUP BY event_id",
    [id]
  );
  const minLen = item.minimumUsableLength ? new Decimal(item.minimumUsableLength) : null;
  const d = damage.rows[0]!;

  return {
    item,
    codes: codes.rows.map((c) => ({ code: c.code, activeFrom: c.active_from.toISOString(), activeTo: c.active_to?.toISOString() ?? null })),
    photos: await Promise.all(photos.rows.map(async (p) => ({ id: p.id, position: p.position, url: await storage.presignGet(p.storage_key) }))),
    totals: Object.fromEntries(CONDITIONS.map((c) => [c, totals[c].toFixed(3)])) as Record<Condition, string>,
    onHand: onHand.toFixed(3),
    balances: balances.rows.map((b) => ({ warehouseCode: b.warehouse_code, locationCode: b.location_code, locationId: b.location_id, eventId: b.event_id, pieceNumber: b.piece_number, pieceId: b.piece_id, condition: b.condition, quantity: b.quantity })),
    pieces: pieces.rows.map((p) => {
      const current = p.current ?? '0.000';
      return { id: p.id, pieceNumber: p.piece_number, originalLength: p.original_length, currentLength: current, status: p.status, belowMinimum: !!minLen && new Decimal(current).gt(0) && new Decimal(current).lt(minLen), locationCode: p.location_code, condition: p.condition };
    }).filter((p) => new Decimal(p.currentLength).gt(0)),
    lastUsedIn: last.rows[0] ? { eventId: last.rows[0].ref, at: last.rows[0].occurred_at.toISOString() } : null,
    reservations: reservations.rows.map((r) => ({ eventId: r.event_id, quantity: r.q })),
    damage: { damagedToDate: d.damaged_to_date, currentlyDamaged: totals.damaged.toFixed(3), writtenOff: d.written_off, lost: toQty(d.lost) },
    history: history.rows.map((h) => ({ id: Number(h.id), type: h.type, quantity: h.quantity, occurredAt: h.occurred_at.toISOString(), reason: h.reason, fromCondition: h.from_condition, toCondition: h.to_condition, referenceType: h.reference_type, referenceId: h.reference_id, actor: h.actor }))
  };
}

/** Presigned upload for one of up to 5 photos (research R7); kept forever (Q12). */
export async function photoUploadUrl(itemId: string, contentType: string) {
  if (!/^image\/(jpeg|png|webp)$/.test(contentType)) throw new ApiError('VALIDATION_FAILED', { fields: { contentType: 'JPEG, PNG or WebP only' } });
  await loadItem(getPool(), itemId);
  const key = `items/${itemId}/${crypto.randomUUID()}`;
  return { key, url: await getStorage().presignPut(key, contentType) };
}

export async function addPhoto(auth: Authenticated, itemId: string, key: string, ctx: RequestContext) {
  if (!key.startsWith(`items/${itemId}/`)) throw new ApiError('VALIDATION_FAILED', { fields: { key: 'Unknown upload' } });
  const head = await getStorage().head(key);
  if (!head) throw new ApiError('VALIDATION_FAILED', { fields: { key: 'Upload not found' } });
  if (head.bytes > 10 * 1024 * 1024) throw new ApiError('VALIDATION_FAILED', { fields: { key: 'Photos must be 10 MB or smaller' } });
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM item_photos WHERE item_id = $1', [itemId]);
    if (rows[0]!.n >= 5) throw new ApiError('VALIDATION_FAILED', { fields: { key: 'At most 5 photos per item' } });
    const ins = await tx.query<{ id: string; position: number }>(
      `INSERT INTO item_photos (item_id, storage_key, bytes, content_type, position, uploaded_by)
       VALUES ($1, $2, $3, $4, (SELECT COALESCE(max(position), 0) + 1 FROM item_photos WHERE item_id = $1), $5) RETURNING id, position`,
      [itemId, key, head.bytes, head.contentType, auth.user.id]
    );
    await writeAudit(tx, { action: 'item.photo_added', actorUserId: auth.user.id, entityType: 'item', entityId: itemId, after: { key }, ctx });
    return ins.rows[0]!;
  });
}
