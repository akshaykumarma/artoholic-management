import ExcelJS from 'exceljs';
import { z } from 'zod';
import { formatDateTimeIST } from '@artoholic/shared';
import { getPool } from '../../db/client';

export interface AuditQuery { from?: string; to?: string; actorId?: string; action?: string; entityType?: string; entityId?: string; cursor?: number; limit?: number }
export interface AuditRow { id: number; at: string; actor: string | null; action: string; entityType: string | null; entityId: string | null; before: unknown; after: unknown; platform: string | null; ip: string | null }

/** Indexed search with keyset paging, newest first (010 research R1). Read-only: there is no edit path. */
export async function searchAudit(q: AuditQuery): Promise<{ items: AuditRow[]; nextCursor: string | null }> {
  const limit = Math.min(q.limit ?? 100, 1000);
  const { rows } = await getPool().query(
    `SELECT a.id, a.occurred_at, u.full_name, a.action, a.entity_type, a.entity_id, a.before, a.after, a.client_platform, host(a.network_address) AS ip
       FROM audit_entries a LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE ($1::date IS NULL OR a.occurred_at >= $1::date - interval '330 minutes') AND ($2::date IS NULL OR a.occurred_at < $2::date + 1 - interval '330 minutes')
        AND ($3::uuid IS NULL OR a.actor_user_id = $3) AND ($4::text IS NULL OR a.action LIKE $4 || '%')
        AND ($5::text IS NULL OR a.entity_type = $5) AND ($6::text IS NULL OR a.entity_id = $6) AND ($7::bigint IS NULL OR a.id < $7)
      ORDER BY a.id DESC LIMIT ${limit + 1}`,
    [q.from ?? null, q.to ?? null, q.actorId ?? null, q.action?.trim() || null, q.entityType ?? null, q.entityId ?? null, q.cursor ?? null]
  );
  const items = rows.slice(0, limit).map((r) => ({
    id: Number(r.id), at: new Date(r.occurred_at).toISOString(), actor: r.full_name, action: r.action, entityType: r.entity_type, entityId: r.entity_id,
    before: r.before, after: r.after, platform: r.client_platform, ip: r.ip
  }));
  return { items, nextCursor: rows.length > limit ? String(items[items.length - 1]!.id) : null };
}

export const AUDIT_INLINE_LIMIT = 100_000;

export async function countAudit(q: AuditQuery): Promise<number> {
  const { rows } = await getPool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM audit_entries a
      WHERE ($1::date IS NULL OR a.occurred_at >= $1::date - interval '330 minutes') AND ($2::date IS NULL OR a.occurred_at < $2::date + 1 - interval '330 minutes')
        AND ($3::uuid IS NULL OR a.actor_user_id = $3) AND ($4::text IS NULL OR a.action LIKE $4 || '%') AND ($5::text IS NULL OR a.entity_type = $5) AND ($6::text IS NULL OR a.entity_id = $6)`,
    [q.from ?? null, q.to ?? null, q.actorId ?? null, q.action?.trim() || null, q.entityType ?? null, q.entityId ?? null]
  );
  return Number(rows[0]!.n);
}

/** Excel export of a search: when, who, action, record, before, after (US1). */
export async function auditXlsx(q: AuditQuery): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Audit log');
  ws.addRow(['Audit log']).font = { bold: true, size: 14 };
  ws.addRow([`Generated ${formatDateTimeIST(new Date())}`]);
  ws.addRow([]);
  ws.addRow(['When (IST)', 'Who', 'Action', 'Record type', 'Record', 'Before', 'After', 'App', 'Network address']).font = { bold: true };
  let cursor: number | undefined;
  for (;;) {
    const page = await searchAudit({ ...q, cursor, limit: 1000 });
    for (const r of page.items) {
      ws.addRow([formatDateTimeIST(r.at), r.actor ?? '', r.action, r.entityType ?? '', r.entityId ?? '', r.before ? JSON.stringify(r.before) : '', r.after ? JSON.stringify(r.after) : '', r.platform ?? '', r.ip ?? '']);
    }
    if (!page.nextCursor) break;
    cursor = Number(page.nextCursor);
  }
  ws.columns.forEach((c, i) => (c.width = i < 5 ? 22 : 40));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const auditQuery = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  actorId: z.string().uuid().optional(), action: z.string().max(80).optional(), entityType: z.string().max(60).optional(), entityId: z.string().max(100).optional(),
  cursor: z.coerce.number().int().positive().optional() });
