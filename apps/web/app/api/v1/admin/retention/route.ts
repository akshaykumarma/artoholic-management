import { api } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { requireSuperAdmin } from '@/server/notifications/admin';
import { retentionView } from '@/server/admin/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);

  return Response.json({ items: await retentionView() });
});
