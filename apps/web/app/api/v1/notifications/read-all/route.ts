import { api } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { markAllRead } from '@/server/notifications/centre';

export const POST = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);

  return Response.json(await markAllRead(auth));
});
