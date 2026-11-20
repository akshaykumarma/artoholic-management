import { z } from 'zod';
import { api, parseBody } from '@/server/http/handler';
import { requireSession } from '@/server/auth/guards';
import { requireSuperAdmin } from '@/server/notifications/admin';
import { recordRestoreTest } from '@/server/admin/backups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({ performedAt: z.string().datetime({ offset: true }), backupRecordId: z.string().uuid().optional(), rpoHours: z.number().min(0).max(9999).optional(),
  rtoHours: z.number().min(0).max(9999).optional(), result: z.enum(['passed', 'failed']), notes: z.string().max(2000).optional() });

export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  requireSuperAdmin(auth);

  return Response.json(await recordRestoreTest(auth, await parseBody(req, body), ctx), { status: 201 });
});
