import { z } from 'zod';
import { updateUserSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { getUser, updateUser } from '@/server/users/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const id = (p: Record<string, string>) => z.string().uuid().parse(p.id);

export const GET = api(async (_req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'users.manage');
  return Response.json(await getUser(id(params)));
});

export const PATCH = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'users.manage');
  const input = await parseBody(req, updateUserSchema);
  return Response.json(await updateUser(auth, id(params), req.headers.get('if-match'), input, ctx));
});
