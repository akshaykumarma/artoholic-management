import type { Category } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';

type Row = { id: string; name: string; parent_id: string | null; status: 'active' | 'archived' };
const map = (r: Row): Category => ({ id: r.id, name: r.name, parentId: r.parent_id, status: r.status });

export async function listCategories(): Promise<Category[]> {
  const { rows } = await getPool().query<Row>('SELECT id, name, parent_id, status FROM categories ORDER BY parent_id NULLS FIRST, name');
  return rows.map(map);
}

/** Two levels only: category → sub-category (003 FR-001). */
export async function createCategory(auth: Authenticated, input: { name: string; parentId?: string | null }, ctx: RequestContext): Promise<Category> {
  return withTransaction(async (tx) => {
    if (input.parentId) {
      const p = await tx.query<{ parent_id: string | null; status: string }>('SELECT parent_id, status FROM categories WHERE id = $1', [input.parentId]);
      if (!p.rows[0]) throw new ApiError('NOT_FOUND');
      if (p.rows[0].parent_id) throw new ApiError('VALIDATION_FAILED', { fields: { parentId: 'Only two levels: category → sub-category' } });
    }
    const dup = await tx.query(`SELECT 1 FROM categories WHERE COALESCE(parent_id, '00000000-0000-0000-0000-000000000000') = COALESCE($1::uuid, '00000000-0000-0000-0000-000000000000') AND lower(name) = lower($2)`, [input.parentId ?? null, input.name]);
    if (dup.rowCount) throw new ApiError('CODE_TAKEN', { field: 'name' }, 'A category with that name already exists here.');
    const { rows } = await tx.query<Row>('INSERT INTO categories (name, parent_id) VALUES ($1, $2) RETURNING id, name, parent_id, status', [input.name, input.parentId ?? null]);
    await writeAudit(tx, { action: 'category.created', actorUserId: auth.user.id, entityType: 'category', entityId: rows[0]!.id, after: input, ctx });
    return map(rows[0]!);
  });
}

export async function updateCategory(auth: Authenticated, id: string, input: { name?: string; status?: 'active' | 'archived' }, ctx: RequestContext): Promise<Category> {
  return withTransaction(async (tx) => {
    const before = await tx.query<Row>('SELECT id, name, parent_id, status FROM categories WHERE id = $1 FOR UPDATE', [id]);
    if (!before.rows[0]) throw new ApiError('NOT_FOUND');
    const { rows } = await tx.query<Row>('UPDATE categories SET name = COALESCE($2, name), status = COALESCE($3::item_status, status) WHERE id = $1 RETURNING id, name, parent_id, status', [id, input.name ?? null, input.status ?? null]);
    await writeAudit(tx, { action: 'category.updated', actorUserId: auth.user.id, entityType: 'category', entityId: id, before: map(before.rows[0]), after: map(rows[0]!), ctx });
    return map(rows[0]!);
  });
}
