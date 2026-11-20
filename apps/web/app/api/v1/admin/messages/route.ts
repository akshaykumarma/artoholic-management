import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { listMessages, requireSuperAdmin } from '@/server/notifications/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const query = z.object({ channel: z.enum(['whatsapp', 'email']).optional(), status: z.string().max(20).optional(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), q: z.string().max(100).optional() });

export const GET = api(async (req, ctx) => {
  const auth = await requireSession(ctx);

  requireSuperAdmin(auth);
  return Response.json({ items: await listMessages(query.parse(Object.fromEntries(new URL(req.url).searchParams))) });
});
