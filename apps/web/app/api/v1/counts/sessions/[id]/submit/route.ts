import { z } from 'zod';
import { countSubmitSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { submitCount } from '@/server/counts/sheet';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'counts.perform');
  const { confirmZero } = await parseBody(req, countSubmitSchema);
  return Response.json(await submitCount(auth, id.parse(params.id), !!confirmZero, ctx));
});
