import { normalisePhone } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';

export interface CompanyProfile { name: string; tagline: string; logoKey: string | null; gstin: string | null; address: string; phone: string | null; email: string | null }

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const { rows } = await getPool().query('SELECT * FROM company_profile WHERE id = 1');
  const r = rows[0] ?? {};
  return { name: r.name ?? 'Artoholic', tagline: r.tagline ?? '', logoKey: r.logo_key ?? null, gstin: r.gstin ?? null, address: r.address ?? '', phone: r.phone_e164 ?? null, email: r.email ?? null };
}

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Company name, logo, GSTIN and address, used on exports and emails (010 US3). */
export async function setCompanyProfile(auth: Authenticated, input: Partial<CompanyProfile>, ctx: RequestContext): Promise<CompanyProfile> {
  const fields: Record<string, string> = {};
  const gstin = input.gstin ? input.gstin.toUpperCase().trim() : input.gstin;
  if (gstin && !GSTIN.test(gstin)) fields.gstin = 'Enter a valid 15-character GSTIN';
  const phone = input.phone ? normalisePhone(input.phone) : input.phone;
  if (input.phone && !phone) fields.phone = 'Enter a valid phone number';
  if (input.logoKey && !input.logoKey.startsWith('logo/')) fields.logoKey = 'Upload the logo first';
  if (Object.keys(fields).length) throw new ApiError('VALIDATION_FAILED', { fields });
  return withTransaction(async (tx) => {
    const before = await getCompanyProfile();
    await tx.query('INSERT INTO company_profile (id) VALUES (1) ON CONFLICT DO NOTHING');
    await tx.query(
      `UPDATE company_profile SET name = COALESCE($1, name), tagline = COALESCE($2, tagline), logo_key = COALESCE($3, logo_key),
         gstin = CASE WHEN $4::boolean THEN $5 ELSE gstin END, address = COALESCE($6, address),
         phone_e164 = CASE WHEN $7::boolean THEN $8 ELSE phone_e164 END, email = CASE WHEN $9::boolean THEN $10 ELSE email END,
         updated_by = $11, updated_at = $12 WHERE id = 1`,
      [input.name ?? null, input.tagline ?? null, input.logoKey ?? null, gstin !== undefined, gstin || null, input.address ?? null,
        phone !== undefined, phone || null, input.email !== undefined, input.email || null, auth.user.id, now()]
    );
    const after = await getCompanyProfile();
    await writeAudit(tx, { action: 'settings.company_profile_updated', actorUserId: auth.user.id, entityType: 'company_profile', entityId: '1', before, after, ctx });
    return after;
  });
}

export const LISTS = ['event_type', 'unit', 'damage_reason', 'short_dispatch_reason'] as const;
export type ListName = (typeof LISTS)[number];
export interface ListValue { id: string; value: string; status: 'active' | 'archived'; inUse: boolean }

/** Master lists (010 US3): event types and units live in their own tables; the reason lists here. */
export async function listValues(list: ListName): Promise<ListValue[]> {
  const pool = getPool();
  if (list === 'event_type') {
    const { rows } = await pool.query('SELECT id, name AS value, status, EXISTS (SELECT 1 FROM events e WHERE e.type_id = t.id) AS in_use FROM event_types t ORDER BY position, name');
    return rows.map((r) => ({ id: r.id, value: r.value, status: r.status, inUse: r.in_use }));
  }
  if (list === 'unit') {
    const { rows } = await pool.query('SELECT code AS id, code || \' · \' || name AS value, status, EXISTS (SELECT 1 FROM items i WHERE i.unit_code = u.code) AS in_use FROM units u ORDER BY family, factor_to_base DESC');
    return rows.map((r) => ({ id: r.id, value: r.value, status: r.status, inUse: r.in_use }));
  }
  const { rows } = await pool.query('SELECT id, value, status FROM master_list_values WHERE list = $1 ORDER BY position, value', [list]);
  return rows.map((r) => ({ id: r.id, value: r.value, status: r.status, inUse: false }));
}

export async function addListValue(auth: Authenticated, list: ListName, value: string, ctx: RequestContext) {
  if (list === 'unit') throw new ApiError('VALIDATION_FAILED', { fields: { list: 'Add units in Inventory → Categories and units (they need a family and factor)' } });
  try {
    await withTransaction(async (tx) => {
      if (list === 'event_type') await tx.query('INSERT INTO event_types (name, position) VALUES ($1, (SELECT COALESCE(max(position), 0) + 1 FROM event_types))', [value]);
      else await tx.query('INSERT INTO master_list_values (list, value, position) VALUES ($1, $2, (SELECT COALESCE(max(position), 0) + 1 FROM master_list_values WHERE list = $1))', [list, value]);
      await writeAudit(tx, { action: 'settings.list_value_added', actorUserId: auth.user.id, entityType: 'master_list', entityId: list, after: { value }, ctx });
    });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new ApiError('CODE_TAKEN', { value }, `${value} is already on the list.`);
    throw e;
  }
  return listValues(list);
}

/** Archive (or reactivate) a value; a value in use can never be deleted (US3-1). */
export async function setListValue(auth: Authenticated, list: ListName, id: string, input: { status?: 'active' | 'archived'; delete?: boolean; value?: string }, ctx: RequestContext) {
  const current = (await listValues(list)).find((v) => v.id === id);
  if (!current) throw new ApiError('NOT_FOUND');
  await withTransaction(async (tx) => {
    const table = list === 'event_type' ? 'event_types' : list === 'unit' ? 'units' : 'master_list_values';
    const key = list === 'unit' ? 'code' : 'id';
    if (input.delete) {
      if (current.inUse) throw new ApiError('VALIDATION_FAILED', { fields: { id: 'This value is in use; archive it instead' } });
      await tx.query(`DELETE FROM ${table} WHERE ${key} = $1`, [id]);
    } else {
      if (input.status) await tx.query(`UPDATE ${table} SET status = $2 WHERE ${key} = $1`, [id, input.status]);
      if (input.value && list !== 'unit') await tx.query(`UPDATE ${table} SET ${list === 'event_type' ? 'name' : 'value'} = $2 WHERE id = $1`, [id, input.value]);
    }
    await writeAudit(tx, { action: input.delete ? 'settings.list_value_deleted' : 'settings.list_value_updated', actorUserId: auth.user.id, entityType: 'master_list', entityId: list, before: current, after: input, ctx });
  });
  return listValues(list);
}
