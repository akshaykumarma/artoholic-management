import { cutSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { cutPiece } from '@/server/stock/operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.move');
  const { pieceId, length, unit } = await parseBody(req, cutSchema);
  return Response.json(await cutPiece(auth, pieceId, length, unit, ctx), { status: 201 });
});
