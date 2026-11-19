import { returnToAvailableSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { returnToAvailable } from '@/server/stock/operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.move');
  return Response.json(await returnToAvailable(auth, await parseBody(req, returnToAvailableSchema), ctx), { status: 201 });
});
