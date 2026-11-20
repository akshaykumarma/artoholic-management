import { z } from 'zod';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { requireSuperAdmin } from '@/server/notifications/admin';
import { getCompanyProfile, setCompanyProfile } from '@/server/admin/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({ name: z.string().trim().min(1).max(120), tagline: z.string().max(200), logoKey: z.string().max(300).nullable(), gstin: z.string().max(15).nullable(),
  address: z.string().max(500), phone: z.string().max(30).nullable(), email: z.string().email().max(200).nullable().or(z.literal('')) }).partial();

export const GET = api(async (_req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'settings.view');
  return Response.json(await getCompanyProfile());
});

export const PUT = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);
  const input = await parseBody(req, body);
  return Response.json(await setCompanyProfile(auth, { ...input, logoKey: input.logoKey ?? undefined, email: input.email === '' ? null : input.email }, ctx));
});
