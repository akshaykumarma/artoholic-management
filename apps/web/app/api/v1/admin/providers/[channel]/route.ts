import { z } from 'zod';
import { providerUpdateSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { getProvider, requireSuperAdmin, setProvider } from '@/server/notifications/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const channel = z.enum(['whatsapp', 'email']);

export const GET = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);

  requireSuperAdmin(auth);
  return Response.json(await getProvider(channel.parse(params.channel)));
});

export const PUT = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);
  return Response.json(await setProvider(auth, channel.parse(params.channel), await parseBody(req, providerUpdateSchema), ctx));
});
