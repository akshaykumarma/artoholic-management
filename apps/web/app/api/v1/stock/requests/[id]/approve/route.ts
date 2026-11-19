import { z } from 'zod';
import { decisionSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { decideRequest } from '@/server/stock/operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.approve');
  const { note } = await parseBody(req, decisionSchema);
  return Response.json(await decideRequest(auth, z.string().uuid().parse(params.id), true, note, ctx));
});
