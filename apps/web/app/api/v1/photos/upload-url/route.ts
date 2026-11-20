import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { getStorage } from '@/server/storage';
import { requireSuperAdmin } from '@/server/notifications/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({ purpose: z.enum(['damage', 'logo']), contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']) });

/** Presigned upload for damage photos (006 R4) and the company logo (010, Super Admin). */
export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  const { purpose, contentType } = await parseBody(req, body);
  if (purpose === 'logo') requireSuperAdmin(auth);
  else requirePermission(auth, 'damage.report');
  const key = `${purpose}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${contentType.split('/')[1]}`;
  return Response.json({ key, url: await getStorage().presignPut(key, contentType) });
});
