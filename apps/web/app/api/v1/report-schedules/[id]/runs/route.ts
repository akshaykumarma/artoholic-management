import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { scheduleRuns } from '@/server/reports/schedules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'reports.schedule');
  return Response.json({ items: await scheduleRuns(z.string().uuid().parse(params.id)) });
});
