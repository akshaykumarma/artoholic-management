import { api } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { unreadCount } from '@/server/notifications/centre';

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);

  return Response.json({ unread: await unreadCount(auth) });
});
