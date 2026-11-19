import { moveSchema } from '@artoholic/shared';
import { moveStock } from '@/server/warehouses/transfers';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.move');
  return Response.json(await moveStock(auth, await parseBody(req, moveSchema), ctx), { status: 201 });
});
