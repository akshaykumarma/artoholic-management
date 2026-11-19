import { z } from 'zod';
import { eventTypeInputSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { updateEventType } from '@/server/events/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'settings.manage');
  return Response.json(await updateEventType(z.string().uuid().parse(params.id), await parseBody(req, eventTypeInputSchema)));
});
