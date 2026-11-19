import { z } from 'zod';
import { shortfallSchema } from '@artoholic/shared';
import { decideShortfall } from '@/server/warehouses/transfers';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.approve');
  return Response.json(await decideShortfall(auth, id.parse(params.id), id.parse(params.lineId), await parseBody(req, shortfallSchema), ctx));
});
