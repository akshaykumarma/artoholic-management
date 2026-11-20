import { z } from 'zod';
import { api } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { ApiError } from '@/server/http/errors';
import { IMPORT_KINDS, previewImport } from '@/server/imports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Multipart upload (kind, file) → dry-run preview with row errors (003 FR-004). */
export const POST = api(async (req, ctx) => {
  const auth = await requireSession(ctx);
  const form = await req.formData();
  const kind = z.enum(IMPORT_KINDS as [string, ...string[]]).parse(form.get('kind')) as (typeof IMPORT_KINDS)[number];
  requirePermission(auth, kind === 'users' ? 'users.manage' : kind === 'locations' ? 'locations.manage' : 'catalogue.manage');
  const file = form.get('file');
  if (!(file instanceof Blob) || file.size === 0) throw new ApiError('VALIDATION_FAILED', { fields: { file: 'Choose a file' } });
  if (file.size > 10 * 1024 * 1024) throw new ApiError('VALIDATION_FAILED', { fields: { file: 'Files must be 10 MB or smaller' } });
  const name = 'name' in file ? String((file as File).name) : 'upload.csv';
  return Response.json(await previewImport(auth, kind, name, Buffer.from(await file.arrayBuffer()), ctx), { status: 201 });
});
