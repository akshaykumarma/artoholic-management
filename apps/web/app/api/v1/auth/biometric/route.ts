import { biometricSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { ApiError } from '@/server/http/errors';
import { getPool } from '@/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Mobile only: remembers that this device session may unlock with biometrics (002 FR-011). */
export const PUT = api(async (req, ctx) => {
  if (ctx.platform === 'web') throw new ApiError('FORBIDDEN');
  const auth = await requireSession(ctx);
  const { enabled } = await parseBody(req, biometricSchema);
  await getPool().query('UPDATE sessions SET biometric_enabled = $2 WHERE id = $1', [auth.session.id, enabled]);
  return new Response(null, { status: 204 });
});
