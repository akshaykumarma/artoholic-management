import { z } from 'zod';
import { damageDecisionSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { approveReport } from '@/server/damage/reports';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'damage.approve');
  const { comment } = await parseBody(req, damageDecisionSchema);
  return Response.json(await approveReport(auth, id.parse(params.id), comment, ctx));
});
