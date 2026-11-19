import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { copyEvent } from '@/server/events/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.manage');
  return Response.json(await copyEvent(auth, z.string().uuid().parse(params.id), ctx), { status: 201 });
});
