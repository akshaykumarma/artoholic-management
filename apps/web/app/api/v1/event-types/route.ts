import { eventTypeInputSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { listEventTypes } from '@/server/events/views';
import { createEventType } from '@/server/events/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (req, ctx) => {
  await requireSession(ctx);
  return Response.json({ items: await listEventTypes(new URL(req.url).searchParams.get('all') === 'true') });
});

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'settings.manage');
  const { name } = await parseBody(req, eventTypeInputSchema);
  return Response.json(await createEventType(name), { status: 201 });
});
