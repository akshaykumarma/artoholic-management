import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { getLineTotals } from '@/server/events/closure';

export const GET = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.view');
  return Response.json({ items: await getLineTotals(auth, id.parse(params.id)) });
});
