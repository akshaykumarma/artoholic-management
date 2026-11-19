import type { Unit } from '@artoholic/shared';
import { convertQuantity } from '@artoholic/shared';
import type { PoolClient } from 'pg';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';

type Row = { code: string; name: string; family: string; factor_to_base: string; status: 'active' | 'archived' };
const map = (r: Row): Unit => ({ code: r.code, name: r.name, family: r.family, factorToBase: String(r.factor_to_base), status: r.status });

export async function listUnits(): Promise<Unit[]> {
  const { rows } = await getPool().query<Row>('SELECT code, name, family, factor_to_base::text, status FROM units ORDER BY family, factor_to_base DESC');
  return rows.map(map);
}

export async function createUnit(auth: Authenticated, input: Omit<Unit, 'status'>, ctx: RequestContext): Promise<Unit> {
  return withTransaction(async (tx) => {
    if ((await tx.query('SELECT 1 FROM units WHERE code = $1', [input.code])).rowCount) throw new ApiError('CODE_TAKEN', { field: 'code' }, 'That unit code already exists.');
    const { rows } = await tx.query<Row>('INSERT INTO units (code, name, family, factor_to_base) VALUES ($1, $2, $3, $4) RETURNING code, name, family, factor_to_base::text, status', [input.code, input.name, input.family, input.factorToBase]);
    await writeAudit(tx, { action: 'unit.created', actorUserId: auth.user.id, entityType: 'unit', entityId: input.code, after: input, ctx });
    return map(rows[0]!);
  });
}

/** A unit in use can be archived, never deleted (spec edge case); its factor cannot change once used. */
export async function updateUnit(auth: Authenticated, code: string, input: { name?: string; status?: 'active' | 'archived' }, ctx: RequestContext): Promise<Unit> {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<Row>('UPDATE units SET name = COALESCE($2, name), status = COALESCE($3::item_status, status) WHERE code = $1 RETURNING code, name, family, factor_to_base::text, status', [code, input.name ?? null, input.status ?? null]);
    if (!rows[0]) throw new ApiError('NOT_FOUND');
    await writeAudit(tx, { action: 'unit.updated', actorUserId: auth.user.id, entityType: 'unit', entityId: code, after: input, ctx });
    return map(rows[0]);
  });
}

/** Converts an entered quantity into the item's own unit (003 US1-5). */
export async function toItemUnit(db: Pick<PoolClient, 'query'>, itemUnit: string | null, quantity: string, enteredUnit?: string): Promise<string> {
  if (!enteredUnit || enteredUnit === itemUnit) return quantity;
  if (!itemUnit) throw new ApiError('VALIDATION_FAILED', { fields: { unit: 'This item is counted in pieces; leave the unit empty' } });
  const { rows } = await db.query<{ code: string; family: string; f: string }>('SELECT code, family, factor_to_base::text AS f FROM units WHERE code = ANY($1)', [[itemUnit, enteredUnit]]);
  const from = rows.find((r) => r.code === enteredUnit);
  const to = rows.find((r) => r.code === itemUnit);
  if (!from || !to || from.family !== to.family) throw new ApiError('VALIDATION_FAILED', { fields: { unit: `Use a ${to?.family ?? ''} unit for this item` } });
  return convertQuantity(quantity, from.f, to.f);
}
