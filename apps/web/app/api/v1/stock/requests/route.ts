import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { listRequests } from '@/server/stock/operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (req, ctx) => {
  requirePermission(await requireSession(ctx), 'stock.approve');
  const status = z.enum(['pending', 'approved', 'rejected']).optional().parse(new URL(req.url).searchParams.get('status') ?? undefined);
  return Response.json({ items: await listRequests(status) });
});
