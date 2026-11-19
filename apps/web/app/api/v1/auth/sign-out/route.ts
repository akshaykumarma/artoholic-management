import { api } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { revokeSession } from '@/server/auth/sessions';
import { writeAudit } from '@/server/audit/write';
import { clearCookie, SESSION_COOKIE } from '@/server/auth/cookies';
import { CSRF_COOKIE } from '@/server/auth/csrf';
import { withTransaction } from '@/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);
  await withTransaction(async (tx) => {
    await revokeSession(tx, auth.session.id);
    await writeAudit(tx, { action: 'auth.sign_out', actorUserId: auth.user.id, entityType: 'session', entityId: auth.session.id, ctx });
  });
  const headers = new Headers();
  if (ctx.platform === 'web') {
    headers.append('set-cookie', clearCookie(SESSION_COOKIE, true));
    headers.append('set-cookie', clearCookie(CSRF_COOKIE));
  }
  return new Response(null, { status: 204, headers });
});
