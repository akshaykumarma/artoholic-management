import { resetPasswordSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { completeReset } from '@/server/auth/reset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(
  async (req, ctx) => {
    const { identifier, code, newPassword } = await parseBody(req, resetPasswordSchema);
    await completeReset(identifier, code, newPassword, ctx);
    return new Response(null, { status: 204 });
  },
  { csrfExempt: true }
);
