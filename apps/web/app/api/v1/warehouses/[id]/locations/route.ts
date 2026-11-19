import { z } from 'zod';
import { locationCreateSchema } from '@artoholic/shared';
import { createLocation, listLocations } from '@/server/warehouses/service';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();

const query = z.object({ parentId: z.string().uuid().optional(), q: z.string().max(40).optional() });

export const GET = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.view');
  const q = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return Response.json({ items: await listLocations(auth, id.parse(params.id), q) });
});

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'locations.manage');
  const body = await parseBody(req, locationCreateSchema);
  return Response.json(await createLocation(auth, id.parse(params.id), body.parentId, body.segment, ctx), { status: 201 });
});
