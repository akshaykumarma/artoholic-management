import { z } from 'zod';
import { itemUpdateSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { itemView, updateItem } from '@/server/catalogue/items';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'catalogue.view');
  return Response.json(await itemView(auth, z.string().uuid().parse(params.id)));
});

export const PATCH = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'catalogue.manage');
  const input = await parseBody(req, itemUpdateSchema);
  return Response.json(await updateItem(auth, z.string().uuid().parse(params.id), req.headers.get('if-match'), input, ctx));
});
