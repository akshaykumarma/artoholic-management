import { releaseInputSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { requireSuperAdmin } from '@/server/notifications/admin';
import { createRelease, listReleases } from '@/server/releases';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);
  return Response.json({ items: await listReleases() });
});

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);
  return Response.json(await createRelease(auth, await parseBody(req, releaseInputSchema), ctx), { status: 201 });
});
