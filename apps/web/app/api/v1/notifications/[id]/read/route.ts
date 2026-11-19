import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { markRead } from '@/server/notifications/centre';

export const POST = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);

  return Response.json(await markRead(auth, z.string().uuid().parse(params.id)));
});
