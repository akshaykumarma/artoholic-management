import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { auditQuery, searchAudit } from '@/server/admin/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Super Admin and Admins (read-only); there is no write route for audit entries (US1-2). */
export const GET = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'audit.view');

  return Response.json(await searchAudit(auditQuery.parse(Object.fromEntries(new URL(req.url).searchParams))));
});
