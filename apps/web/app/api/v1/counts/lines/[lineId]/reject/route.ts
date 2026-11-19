import { z } from 'zod';
import { countDecisionSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { decideLine } from '@/server/counts/sheet';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'counts.schedule');
  const { reason } = await parseBody(req, countDecisionSchema);
  return Response.json(await decideLine(auth, id.parse(params.lineId), 'reject', reason, ctx));
});
