import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { getStorage } from '@/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({ purpose: z.literal('damage'), contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']) });

/** Presigned upload for damage photos (006 R4); the key is referenced from checklist entries. */
export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'damage.report');
  const { contentType } = await parseBody(req, body);
  const key = `damage/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${contentType.split('/')[1]}`;
  return Response.json({ key, url: await getStorage().presignPut(key, contentType) });
});
