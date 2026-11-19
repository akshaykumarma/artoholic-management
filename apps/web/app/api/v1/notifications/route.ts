import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { listNotifications } from '@/server/notifications/centre';

const query = z.object({ cursor: z.coerce.number().int().min(0).optional(), unread: z.enum(['true', 'false']).optional() });

export const GET = api(async (req, ctx) => {
  const auth = await requireSession(ctx);

  const q = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return Response.json(await listNotifications(auth, { cursor: q.cursor, unread: q.unread === 'true' }));
});
