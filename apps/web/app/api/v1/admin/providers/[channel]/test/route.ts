import { z } from 'zod';
import { api, parseBody } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { requireSuperAdmin, sendTest } from '@/server/notifications/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({ to: z.string().min(3).max(200) });

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);

  requireSuperAdmin(auth);
  const { to } = await parseBody(req, body);
  return Response.json(await sendTest(auth, z.enum(['whatsapp', 'email']).parse(params.channel), to));
});
