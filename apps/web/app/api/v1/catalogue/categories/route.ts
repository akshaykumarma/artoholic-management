import { categoryInputSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { createCategory, listCategories } from '@/server/catalogue/categories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx) => {
  requirePermission(await requireSession(ctx), 'catalogue.view');
  return Response.json({ items: await listCategories() });
});

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'catalogue.manage');
  return Response.json(await createCategory(auth, await parseBody(req, categoryInputSchema), ctx), { status: 201 });
});
