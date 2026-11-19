import { z } from 'zod';
import { cancelTransfer } from '@/server/warehouses/transfers';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();

export const POST = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.move');
  return Response.json(await cancelTransfer(auth, id.parse(params.id), ctx));
});
