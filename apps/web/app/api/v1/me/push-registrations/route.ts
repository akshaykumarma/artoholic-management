import { pushRegistrationSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { registerPush } from '@/server/notifications/centre';

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);

  const { expoToken } = await parseBody(req, pushRegistrationSchema);
  return Response.json(await registerPush(auth, expoToken, ctx.platform), { status: 201 });
});
