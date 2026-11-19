import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { getAdminStatus } from '@/server/health/status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'admin.status.view');
  return Response.json(await getAdminStatus());
});
