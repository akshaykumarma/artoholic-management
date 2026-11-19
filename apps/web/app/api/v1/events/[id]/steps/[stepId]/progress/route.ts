import { z } from 'zod';
import { progressSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { saveProgress } from '@/server/checklists/steps';

export const PUT = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.view');
  const { entries } = await parseBody(req, progressSchema);
  return Response.json(await saveProgress(auth, id.parse(params.id), id.parse(params.stepId), entries));
});
