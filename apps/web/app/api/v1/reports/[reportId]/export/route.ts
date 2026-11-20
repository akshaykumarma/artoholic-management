import { z } from 'zod';
import { REPORT_IDS, reportFiltersSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { exportReport } from '@/server/reports/run';

/** Generates the .xlsx and returns the run (US1); download from /reports/runs/{runId}/download. */
export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'reports.run');
  const { filters } = await parseBody(req, z.object({ filters: reportFiltersSchema.default({}) }));
  const r = await exportReport({ auth, reportId: z.enum(REPORT_IDS).parse(params.reportId), filters });
  return Response.json({ runId: r.runId, rowCount: r.rowCount }, { status: 202 });
});
