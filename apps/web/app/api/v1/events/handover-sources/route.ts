import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { handoverSources } from '@/server/events/views';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const query = z.object({ itemId: z.string().uuid(), leaveAt: z.string().datetime({ offset: true }), eventId: z.string().uuid().optional() });

export const GET = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.manage');
  const q = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return Response.json({ items: await handoverSources(q.itemId, q.leaveAt, q.eventId) });
});
