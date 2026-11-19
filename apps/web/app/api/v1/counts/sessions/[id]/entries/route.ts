import { z } from 'zod';
import { countEntriesSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { saveEntries } from '@/server/counts/sheet';

export const PUT = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'counts.perform');
  const { entries } = await parseBody(req, countEntriesSchema);
  return Response.json(await saveEntries(auth, id.parse(params.id), entries, ctx));
});
