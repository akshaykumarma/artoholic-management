import { z } from 'zod';
import { reactivateSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { reactivateUser } from '@/server/users/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'users.manage');
  const body = await parseBody(req, reactivateSchema);
  await reactivateUser(auth, z.string().uuid().parse(params.id), body.temporaryPassword, ctx);
  return new Response(null, { status: 204 });
});
