import { z } from 'zod';
import { recheckSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { recheckReport } from '@/server/checklists/submit';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'damage.report');
  return Response.json(await recheckReport(auth, id.parse(params.id), await parseBody(req, recheckSchema), ctx));
});
