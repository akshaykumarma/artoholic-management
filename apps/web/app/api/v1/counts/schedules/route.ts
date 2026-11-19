import { countScheduleInputSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createSchedule, listSchedules } from '@/server/counts/schedules';

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'counts.schedule');
  return Response.json({ items: await listSchedules() });
});

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'counts.schedule');
  return Response.json(await createSchedule(auth, await parseBody(req, countScheduleInputSchema), ctx), { status: 201 });
});
