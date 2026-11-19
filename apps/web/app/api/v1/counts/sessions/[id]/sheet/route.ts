import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = z.string().uuid();
import { getSheet } from '@/server/counts/sheet';

export const GET = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'counts.perform');
  return Response.json(await getSheet(auth, id.parse(params.id)));
});
