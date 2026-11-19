import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { recordMessages } from '@/server/notifications/admin';
import { requireEventAccess } from '@/server/events/events';

/** Message log for one record; events follow event access, anything else needs the audit permission. */
export const GET = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);

  const type = z.enum(['event', 'damage_report', 'count_session', 'user', 'item', 'message']).parse(params.type);
  const id = z.string().min(1).max(100).parse(params.id);
  if (type === 'event') await requireEventAccess(auth, id);
  else requirePermission(auth, 'audit.view');
  return Response.json({ items: await recordMessages(type, id) });
});
