import { z } from 'zod';
import { binSuggestions } from '@/server/warehouses/service';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();

const query = z.object({ itemId: z.string().uuid().optional(), q: z.string().max(40).optional() });

export const GET = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.view');
  const q = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return Response.json({ items: await binSuggestions(auth, id.parse(params.id), q.itemId, q.q) });
});
