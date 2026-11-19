import { z } from 'zod';
import { submitStepSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { submitStep } from '@/server/checklists/submit';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.view');
  return Response.json(await submitStep(auth, id.parse(params.id), id.parse(params.stepId), await parseBody(req, submitStepSchema), ctx));
});
