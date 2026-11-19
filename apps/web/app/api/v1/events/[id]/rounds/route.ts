import { z } from 'zod';
import { newRoundSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { getRounds } from '@/server/checklists/steps';
import { addRound } from '@/server/checklists/rounds';

export const GET = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.view');
  return Response.json(await getRounds(auth, id.parse(params.id)));
});

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.manage');
  const { lines } = await parseBody(req, newRoundSchema);
  return Response.json(await addRound(auth, id.parse(params.id), lines, ctx), { status: 201 });
});
