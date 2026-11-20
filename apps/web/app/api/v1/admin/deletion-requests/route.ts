import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { listDeletionRequests } from '@/server/deletion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'users.manage');
  return Response.json({ items: await listDeletionRequests() });
});
