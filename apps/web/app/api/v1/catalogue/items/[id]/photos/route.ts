import { z } from 'zod';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { addPhoto } from '@/server/catalogue/items';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'catalogue.manage');
  const { key } = await parseBody(req, z.object({ key: z.string().min(1) }));
  return Response.json(await addPhoto(auth, z.string().uuid().parse(params.id), key, ctx), { status: 201 });
});
