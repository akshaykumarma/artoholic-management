import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { requireSuperAdmin } from '@/server/notifications/admin';
import { activeSessions } from '@/server/admin/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);

  const userId = z.string().uuid().optional().parse(new URL(req.url).searchParams.get('userId') ?? undefined);
  return Response.json({ items: await activeSessions(userId) });
});
