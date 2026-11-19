import { signInRequestSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { signIn } from '@/server/auth/sign-in';
import { buildMe } from '@/server/auth/me';
import { serializeCookie, SESSION_COOKIE } from '@/server/auth/cookies';
import { newCsrfToken, CSRF_COOKIE } from '@/server/auth/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(
  async (req, ctx) => {
    const { username, password } = await parseBody(req, signInRequestSchema);
    const { token, auth } = await signIn(username, password, ctx);
    const user = buildMe(auth, ctx.platform);
    if (ctx.platform !== 'web') {
      return Response.json({ user, token, expiresAt: auth.session.expiresAt.toISOString() });
    }
    const headers = new Headers();
    headers.append('set-cookie', serializeCookie(SESSION_COOKIE, token, { httpOnly: true }));
    headers.append('set-cookie', serializeCookie(CSRF_COOKIE, newCsrfToken()));
    return Response.json({ user }, { headers });
  },
  { csrfExempt: true }
);
