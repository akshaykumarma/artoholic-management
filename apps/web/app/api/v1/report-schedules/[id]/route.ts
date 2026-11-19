import { z } from 'zod';
import { reportScheduleUpdateSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { deleteSchedule, updateSchedule } from '@/server/reports/schedules';

export const PATCH = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'reports.schedule');
  return Response.json(await updateSchedule(auth, z.string().uuid().parse(params.id), await parseBody(req, reportScheduleUpdateSchema), ctx));
});

export const DELETE = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'reports.schedule');
  await deleteSchedule(auth, z.string().uuid().parse(params.id), ctx);
  return new Response(null, { status: 204 });
});
