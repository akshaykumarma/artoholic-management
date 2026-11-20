import { z } from 'zod';
import { releaseCheckInputSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { requireSuperAdmin } from '@/server/notifications/admin';
import { recordCheck } from '@/server/releases';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);
  return Response.json(await recordCheck(auth, z.string().uuid().parse(params.id), await parseBody(req, releaseCheckInputSchema), ctx));
});
