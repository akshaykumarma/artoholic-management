import { writeOffSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { requestWriteOff } from '@/server/stock/operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'stock.move');
  const r = await requestWriteOff(auth, await parseBody(req, writeOffSchema), ctx);
  return Response.json({ id: r.id, status: r.status, kind: r.kind }, { status: 202 });
});
