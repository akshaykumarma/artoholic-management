import { unitInputSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { createUnit, listUnits } from '@/server/catalogue/units';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx) => {
  requirePermission(await requireSession(ctx), 'catalogue.view');
  return Response.json({ items: await listUnits() });
});

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'catalogue.manage');
  return Response.json(await createUnit(auth, await parseBody(req, unitInputSchema.omit({ status: true })), ctx), { status: 201 });
});
