import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { calendarMonth } from '@/server/events/views';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const query = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

export const GET = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'events.view');
  const { month } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return Response.json({ month, items: await calendarMonth(auth, month) });
});
