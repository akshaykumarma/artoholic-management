import { z } from 'zod';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { requireSuperAdmin } from '@/server/notifications/admin';
import { addListValue, LISTS, listValues, setListValue } from '@/server/admin/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const list = z.enum(LISTS);

export const GET = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'settings.view');
  return Response.json({ items: await listValues(list.parse(params.list)) });
});

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);
  const { value } = await parseBody(req, z.object({ value: z.string().trim().min(1).max(80) }));
  return Response.json({ items: await addListValue(auth, list.parse(params.list), value, ctx) }, { status: 201 });
});

export const PATCH = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);
  const b = await parseBody(req, z.object({ id: z.string().min(1).max(60), status: z.enum(['active', 'archived']).optional(), value: z.string().trim().min(1).max(80).optional(), delete: z.boolean().optional() }));
  return Response.json({ items: await setListValue(auth, list.parse(params.list), b.id, b, ctx) });
});
