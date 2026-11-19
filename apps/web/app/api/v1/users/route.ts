import { z } from 'zod';
import { createUserSchema, ROLES } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { createUser, listUsers } from '@/server/users/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const listQuery = z.object({
  q: z.string().max(200).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(['active', 'deactivated']).optional(),
  warehouseId: z.string().uuid().optional(),
  cursor: z.coerce.number().int().min(0).optional()
});

export const GET = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'users.manage');
  const query = listQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  return Response.json(await listUsers(query));
});

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'users.manage');
  const input = await parseBody(req, createUserSchema);
  return Response.json(await createUser(auth, input, ctx), { status: 201 });
});
