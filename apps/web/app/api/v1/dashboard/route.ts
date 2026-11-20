import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { dashboard } from '@/server/dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.approve');
  return Response.json(await dashboard());
});
