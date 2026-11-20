import { api } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { requireSuperAdmin } from '@/server/notifications/admin';
import { listBackups } from '@/server/admin/backups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);

  return Response.json(await listBackups());
});
