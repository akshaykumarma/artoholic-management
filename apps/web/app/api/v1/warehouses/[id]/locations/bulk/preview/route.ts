import { z } from 'zod';
import { bulkLocationsSchema } from '@artoholic/shared';
import { previewBulk } from '@/server/warehouses/service';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'locations.manage');
  const body = await parseBody(req, bulkLocationsSchema);
  return Response.json(await previewBulk(auth, id.parse(params.id), body.parentId, body.ranges));
});
