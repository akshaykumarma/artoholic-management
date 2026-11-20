import { z } from 'zod';
import { templateMappingSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { listTemplates, requireSuperAdmin, setTemplates } from '@/server/notifications/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);

  requireSuperAdmin(auth);
  return Response.json({ items: await listTemplates() });
});

export const PUT = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);
  const { items } = await parseBody(req, z.object({ items: z.array(templateMappingSchema).max(200) }));
  return Response.json({ items: await setTemplates(auth, items, ctx) });
});
