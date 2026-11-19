import { z } from 'zod';
import { warehouseUpdateSchema } from '@artoholic/shared';
import { getWarehouse, updateWarehouse } from '@/server/warehouses/service';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();

export const GET = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.view');
  return Response.json(await getWarehouse(auth, id.parse(params.id)));
});

export const PATCH = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'warehouses.manage');
  return Response.json(await updateWarehouse(auth, id.parse(params.id), await parseBody(req, warehouseUpdateSchema), ctx));
});
