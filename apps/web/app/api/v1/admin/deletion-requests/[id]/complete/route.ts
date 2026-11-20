import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { completeDeletion } from '@/server/deletion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'users.manage');
  return Response.json(await completeDeletion(auth, z.string().uuid().parse(params.id), ctx));
});
