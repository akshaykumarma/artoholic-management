import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { requireSuperAdmin } from '@/server/notifications/admin';
import { signIns } from '@/server/admin/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);

  const q = z.object({ userId: z.string().uuid().optional(), from: z.string().optional(), to: z.string().optional() }).parse(Object.fromEntries(new URL(req.url).searchParams));
  return Response.json({ items: await signIns(q) });
});
