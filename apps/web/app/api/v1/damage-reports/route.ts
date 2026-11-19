import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { listReports } from '@/server/damage/reports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const query = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional(), eventId: z.string().uuid().optional() });

export const GET = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'damage.report');
  return Response.json({ items: await listReports(auth, query.parse(Object.fromEntries(new URL(req.url).searchParams))) });
});
