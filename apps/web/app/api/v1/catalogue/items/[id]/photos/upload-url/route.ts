import { z } from 'zod';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { photoUploadUrl } from '@/server/catalogue/items';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (req, ctx, params) => {
  requirePermission(await requireSession(ctx), 'catalogue.manage');
  const { contentType } = await parseBody(req, z.object({ contentType: z.string() }));
  return Response.json(await photoUploadUrl(z.string().uuid().parse(params.id), contentType));
});
