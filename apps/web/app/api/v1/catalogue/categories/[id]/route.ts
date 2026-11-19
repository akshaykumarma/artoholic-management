import { z } from 'zod';
import { categoryInputSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { updateCategory } from '@/server/catalogue/categories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'catalogue.manage');
  const input = await parseBody(req, categoryInputSchema.pick({ name: true, status: true }).partial());
  return Response.json(await updateCategory(auth, z.string().uuid().parse(params.id), input, ctx));
});
