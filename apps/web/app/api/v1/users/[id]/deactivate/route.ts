import { z } from 'zod';
import { deactivateSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { deactivateUser } from '@/server/users/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'users.manage');
  const body = await parseBody(req, deactivateSchema);
  await deactivateUser(auth, z.string().uuid().parse(params.id), body.reason, ctx);
  return new Response(null, { status: 204 });
});
