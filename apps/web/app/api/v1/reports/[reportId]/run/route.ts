import { z } from 'zod';
import { REPORT_IDS, reportRunSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { runReport } from '@/server/reports/run';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'reports.run');
  const { filters, page, pageSize } = await parseBody(req, reportRunSchema);
  return Response.json(await runReport(auth, z.enum(REPORT_IDS).parse(params.reportId), filters, page, pageSize));
});
