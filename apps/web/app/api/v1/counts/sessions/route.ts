import { z } from 'zod';
import { adHocCountSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { listSessions, startAdHoc } from '@/server/counts/sessions';

const query = z.object({ status: z.enum(['open', 'submitted', 'in_review', 'completed']).optional() });

export const GET = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'counts.perform');
  return Response.json({ items: await listSessions(auth, query.parse(Object.fromEntries(new URL(req.url).searchParams))) });
});

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'counts.schedule');
  return Response.json(await startAdHoc(auth, await parseBody(req, adHocCountSchema), ctx), { status: 201 });
});
