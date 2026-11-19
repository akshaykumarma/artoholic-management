import { preferencesSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { getPreferences, setPreferences } from '@/server/notifications/centre';

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);

  return Response.json(await getPreferences(auth));
});

export const PUT = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  return Response.json(await setPreferences(auth, await parseBody(req, preferencesSchema)));
});
