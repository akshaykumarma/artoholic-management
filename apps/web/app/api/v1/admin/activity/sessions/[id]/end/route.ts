import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { requireSuperAdmin } from '@/server/notifications/admin';
import { endSession } from '@/server/admin/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);

  return Response.json(await endSession(auth, z.string().uuid().parse(params.id), ctx));
});
