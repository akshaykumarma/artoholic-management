import { z } from 'zod';
import { transferDispatchSchema } from '@artoholic/shared';
import { dispatchTransfer } from '@/server/warehouses/transfers';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.move');
  const body = await parseBody(req, transferDispatchSchema);
  return Response.json(await dispatchTransfer(auth, id.parse(params.id), body.lines, ctx));
});
