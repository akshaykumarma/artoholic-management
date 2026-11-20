import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { IMPORT_KINDS, templateXlsx } from '@/server/imports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(async (_req, ctx, params) => {
  requirePermission(await requireSession(ctx), 'catalogue.manage');
  const kind = z.enum(IMPORT_KINDS as [string, ...string[]]).parse(params.kind) as (typeof IMPORT_KINDS)[number];
  return new Response(new Uint8Array(await templateXlsx(kind)), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="artoholic-${kind}-template.xlsx"`
    }
  });
});
