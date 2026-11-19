import { openingStockSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { openingStock } from '@/server/stock/operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.move');
  const { lines } = await parseBody(req, openingStockSchema);
  return Response.json({ posted: await openingStock(auth, lines, ctx) }, { status: 201 });
});
