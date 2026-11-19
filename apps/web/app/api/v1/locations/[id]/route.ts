import { z } from 'zod';
import { locationUpdateSchema } from '@artoholic/shared';
import { updateLocation } from '@/server/warehouses/service';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();

export const PATCH = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'locations.manage');
  return Response.json(await updateLocation(auth, id.parse(params.id), await parseBody(req, locationUpdateSchema), ctx));
});
