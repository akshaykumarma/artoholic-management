import { z } from 'zod';
import { rejectDecisionSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { rejectReport } from '@/server/damage/reports';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'damage.approve');
  const { comment } = await parseBody(req, rejectDecisionSchema);
  return Response.json(await rejectReport(auth, id.parse(params.id), comment, ctx));
});
