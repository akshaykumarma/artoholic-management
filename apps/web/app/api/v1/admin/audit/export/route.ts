import { z } from 'zod';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { AUDIT_INLINE_LIMIT, auditQuery, auditXlsx, countAudit } from '@/server/admin/audit';
import { getStorage } from '@/server/storage';
import { getPool } from '@/db/client';
import { emit } from '@/server/notifications/outbox';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Up to 100,000 rows: the .xlsx straight away; more: generated in the background and sent as a link (edge case). */
export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'audit.view');

  const q = auditQuery.parse(await parseBody(req, z.record(z.string()).default({})));
  if ((await countAudit(q)) <= AUDIT_INLINE_LIMIT) {
    return new Response(new Uint8Array(await auditXlsx(q)), { headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': 'attachment; filename="audit-log.xlsx"' } });
  }
  void (async () => {
    const buf = await auditXlsx(q);
    const key = `exports/${randomUUID()}.xlsx`;
    await getStorage().putObject(key, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const { rows } = await getPool().query<{ id: string }>("INSERT INTO report_runs (report_id, requested_by, filters, status, finished_at, file_key, file_name, file_bytes) VALUES ('AUDIT', $1, $2, 'succeeded', now(), $3, 'audit-log.xlsx', $4) RETURNING id",
      [auth.user.id, JSON.stringify(q), key, buf.length]);
    await emit(getPool(), 'report.ready', { recordType: 'report_run', recordId: rows[0]!.id, payload: { name: 'Audit log export', period: '', downloadPath: `/api/v1/reports/runs/${rows[0]!.id}/download`, link: '/admin/audit', recipientIds: [auth.user.id] } });
  })();
  return Response.json({ queued: true }, { status: 202 });
});
