import { mobilePlatformSchema, mobileVersionUpdateSchema } from '@artoholic/shared';
import { api, parseBody } from '@/server/http/handler';
import { requirePermission, requireSession } from '@/server/auth/guards';
import { updateVersionSettings } from '@/server/versions/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = api(async (req, ctx, params) => {
  const auth = await requireSession(ctx);
  requirePermission(auth, 'admin.mobile_versions.edit');
  const platform = mobilePlatformSchema.parse(params.platform);
  const input = await parseBody(req, mobileVersionUpdateSchema);
  return Response.json(await updateVersionSettings(platform, input, auth.user.id, ctx));
});
