import { z } from 'zod';
import { MOVEMENT_TYPES } from '@artoholic/shared';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { listMovements } from '@/server/stock/operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const query = z.object({ itemId: z.string().uuid().optional(), locationId: z.string().uuid().optional(), type: z.enum(MOVEMENT_TYPES).optional(), cursor: z.coerce.number().int().optional() });

export const GET = api(async (req, ctx) => {
  requirePermission(await requireSession(ctx), 'stock.view');
  return Response.json(await listMovements(query.parse(Object.fromEntries(new URL(req.url).searchParams))));
});
