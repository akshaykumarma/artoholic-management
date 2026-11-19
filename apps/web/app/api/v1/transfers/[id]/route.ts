import { z } from 'zod';
import { getTransfer } from '@/server/warehouses/transfers';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();

export const GET = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.view');
  return Response.json(await getTransfer(auth, id.parse(params.id)));
});
