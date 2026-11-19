import { warehouseInputSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { createWarehouse, listWarehouses } from '@/server/warehouses/basic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.view');
  return Response.json({ items: await listWarehouses(auth) });
});

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'warehouses.manage');
  return Response.json(await createWarehouse(auth, await parseBody(req, warehouseInputSchema), ctx), { status: 201 });
});
