import { z } from 'zod';
import { itemInputSchema, CONDITIONS } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { createItem, listItems } from '@/server/catalogue/items';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const query = z.object({
  q: z.string().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  condition: z.enum(CONDITIONS).optional(),
  belowMinimum: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  status: z.enum(['active', 'archived']).optional(),
  cursor: z.coerce.number().int().min(0).optional()
});

export const GET = api(async (req, ctx) => {
  requirePermission(await requireSession(ctx), 'catalogue.view');
  return Response.json(await listItems(query.parse(Object.fromEntries(new URL(req.url).searchParams))));
});

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'catalogue.manage');
  return Response.json(await createItem(auth, await parseBody(req, itemInputSchema), ctx), { status: 201 });
});
