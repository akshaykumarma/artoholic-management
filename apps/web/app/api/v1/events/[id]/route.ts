import { z } from 'zod';
import { eventInputSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { getEvent, updateEvent } from '@/server/events/events';

export const GET = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.view');
  return Response.json(await getEvent(auth, id.parse(params.id)));
});

export const PATCH = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.manage');
  return Response.json(await updateEvent(auth, id.parse(params.id), req.headers.get('if-match'), await parseBody(req, eventInputSchema), ctx));
});
