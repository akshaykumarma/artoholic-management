import { forgotPasswordSchema, t } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requestReset } from '@/server/auth/reset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Always the same answer, whether or not an account matches (002 SC-005). */
export const POST = api(
  async (req, ctx) => {
    const { identifier } = await parseBody(req, forgotPasswordSchema);
    await requestReset(identifier, ctx);
    return Response.json({ message: t('forgot.sent') }, { status: 202 });
  },
  { csrfExempt: true }
);
