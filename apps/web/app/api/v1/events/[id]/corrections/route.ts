import { z } from 'zod';
import { eventCorrectionSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { correctEvent } from '@/server/events/corrections';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.edit_closed');
  return Response.json(await correctEvent(auth, id.parse(params.id), await parseBody(req, eventCorrectionSchema), ctx), { status: 201 });
});
