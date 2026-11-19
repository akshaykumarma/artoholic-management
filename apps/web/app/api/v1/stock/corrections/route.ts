import { correctionSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { requestCorrection } from '@/server/stock/operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 201 when applied (Admin), 202 when waiting for an Admin (Store Manager). */
export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.move');
  const { applied, request } = await requestCorrection(auth, await parseBody(req, correctionSchema), ctx);
  return Response.json({ id: request.id, status: request.status, kind: request.kind }, { status: applied ? 201 : 202 });
});
