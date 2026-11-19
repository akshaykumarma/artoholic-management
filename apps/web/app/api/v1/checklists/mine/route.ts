import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { myOpenSteps } from '@/server/checklists/steps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.view');
  return Response.json({ items: await myOpenSteps(auth) });
});
