import { z } from 'zod';
import { transferReceiveSchema } from '@artoholic/shared';
import { receiveTransfer } from '@/server/warehouses/transfers';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.move');
  return Response.json(await receiveTransfer(auth, id.parse(params.id), await parseBody(req, transferReceiveSchema), ctx));
});
