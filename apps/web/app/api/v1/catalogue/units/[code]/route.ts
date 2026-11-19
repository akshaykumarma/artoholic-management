import { unitInputSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { updateUnit } from '@/server/catalogue/units';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'catalogue.manage');
  return Response.json(await updateUnit(auth, String(params.code), await parseBody(req, unitInputSchema.pick({ name: true, status: true }).partial()), ctx));
});
