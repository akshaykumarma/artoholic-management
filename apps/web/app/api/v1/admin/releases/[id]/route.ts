import { z } from 'zod';
import { releaseUpdateSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { requireSuperAdmin } from '@/server/notifications/admin';
import { setStoreStatus } from '@/server/releases';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);
  return Response.json(await setStoreStatus(auth, z.string().uuid().parse(params.id), await parseBody(req, releaseUpdateSchema), ctx));
});
