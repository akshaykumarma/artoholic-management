import { z } from 'zod';
import { cancelEventSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { cancelEvent } from '@/server/events/events';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.manage');
  const { reason } = await parseBody(req, cancelEventSchema);
  return Response.json(await cancelEvent(auth, id.parse(params.id), reason, ctx));
});
