import { z } from 'zod';
import { countScheduleUpdateSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { updateSchedule } from '@/server/counts/schedules';

export const PATCH = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'counts.schedule');
  return Response.json(await updateSchedule(auth, id.parse(params.id), await parseBody(req, countScheduleUpdateSchema), ctx));
});
