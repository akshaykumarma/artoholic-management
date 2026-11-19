import { z } from 'zod';
import { transferCreateSchema } from '@artoholic/shared';
import { createTransfer, listTransfers } from '@/server/warehouses/transfers';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


const query = z.object({ status: z.enum(['requested', 'dispatched', 'received', 'cancelled']).optional() });

export const GET = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.view');
  return Response.json({ items: await listTransfers(auth, query.parse(Object.fromEntries(new URL(req.url).searchParams))) });
});

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.move');
  return Response.json(await createTransfer(auth, await parseBody(req, transferCreateSchema), ctx), { status: 201 });
});
