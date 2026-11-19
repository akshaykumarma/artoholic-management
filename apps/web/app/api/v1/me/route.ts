import { api } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { buildMe } from '@/server/auth/me';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx, { allowPasswordChange: true });
  return Response.json(buildMe(auth, ctx.platform));
});
