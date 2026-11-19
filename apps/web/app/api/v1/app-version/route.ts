import { mobilePlatformSchema } from '@artoholic/shared';
import { api } from '@/server/http/handler';
import { getVersionSettings } from '@/server/versions/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public, ungated: apps check their version on launch and foreground, before signing in. */
export const GET = api(
  async (req) => {
    const platform = mobilePlatformSchema.parse(new URL(req.url).searchParams.get('platform'));
    return Response.json(await getVersionSettings(platform));
  },
  { versionGateExempt: true }
);
