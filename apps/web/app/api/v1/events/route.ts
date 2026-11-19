import { z } from 'zod';
import { eventCreateSchema, EVENT_STATUSES } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { createEvent } from '@/server/events/events';
import { listEvents } from '@/server/events/views';

const query = z.object({
  status: z.enum(EVENT_STATUSES).optional(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  typeId: id.optional(), managerId: id.optional(), warehouseId: id.optional(), overbooked: z.enum(['true', 'false']).optional(),
  q: z.string().max(100).optional(), cursor: z.coerce.number().int().min(0).optional()
});

export const GET = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.view');
  const q = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return Response.json(await listEvents(auth, { ...q, overbooked: q.overbooked === 'true' }));
});

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.manage');
  return Response.json(await createEvent(auth, await parseBody(req, eventCreateSchema), ctx), { status: 201 });
});
