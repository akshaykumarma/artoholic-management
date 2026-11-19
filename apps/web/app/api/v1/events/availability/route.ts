import { availabilityRequestSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { checkAvailability } from '@/server/events/views';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.manage');
  return Response.json(await checkAvailability(await parseBody(req, availabilityRequestSchema)));
});
