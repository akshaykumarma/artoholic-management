import { changePasswordSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { changePassword } from '@/server/auth/change-password';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx, { allowPasswordChange: true });
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);
  await changePassword(auth, currentPassword, newPassword, ctx);
  return new Response(null, { status: 204 });
});
