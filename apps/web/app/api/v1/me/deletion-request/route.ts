import { api } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { requestDeletion } from '@/server/deletion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Any signed-in user can ask for their account to be deleted (011 FR-007). */
export const POST = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);
  return Response.json(await requestDeletion(auth, ctx), { status: 201 });
});
