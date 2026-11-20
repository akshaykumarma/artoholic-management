import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { commitImport } from '@/server/imports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'catalogue.manage');
  const body = await req.json().catch(() => ({})) as { excludeErrors?: unknown };
  return Response.json(await commitImport(auth, z.string().uuid().parse(params.id), ctx, { excludeErrors: body.excludeErrors === true }));
});
