import { assertVersionLive } from '../releases';
import { compareVersions } from '@artoholic/shared';
import type { PoolClient } from 'pg';
import type { MobilePlatform, MobileVersionSetting, MobileVersionUpdate } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { writeAudit } from '../audit/write';
import type { RequestContext } from '../http/context';

const TTL_MS = 30_000;
let cache: { at: number; rows: Map<MobilePlatform, MobileVersionSetting> } | undefined;

async function load(db: Pick<PoolClient, 'query'>): Promise<Map<MobilePlatform, MobileVersionSetting>> {
  const { rows } = await db.query<{ platform: MobilePlatform; minimum_version: string; recommended_version: string; store_url: string }>(
    'SELECT platform, minimum_version, recommended_version, store_url FROM mobile_version_settings'
  );
  return new Map(rows.map((r) => [r.platform, { platform: r.platform, minimumVersion: r.minimum_version, recommendedVersion: r.recommended_version, storeUrl: r.store_url }]));
}

/** Settings are read from the database and cached at most 30 s (research R7). */
export async function getVersionSettings(platform: MobilePlatform): Promise<MobileVersionSetting> {
  if (!cache || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), rows: await load(getPool()) };
  const s = cache.rows.get(platform);
  if (!s) throw new Error(`No version settings for ${platform}`);
  return s;
}

export function clearVersionCache(): void {
  cache = undefined;
}

export async function updateVersionSettings(
  platform: MobilePlatform,
  input: MobileVersionUpdate,
  actorUserId: string,
  ctx: RequestContext
): Promise<MobileVersionSetting> {
  const saved = await withTransaction(async (tx) => {
    const before = (await load(tx)).get(platform);
    // Raising the minimum is only allowed to a version that is already live in that store (011 FR-004).
    if (before && compareVersions(input.minimumVersion, before.minimumVersion) > 0) await assertVersionLive(tx, platform, input.minimumVersion);
    await tx.query(
      `UPDATE mobile_version_settings SET minimum_version = $2, recommended_version = $3, store_url = $4, updated_at = now(), updated_by = $5
       WHERE platform = $1`,
      [platform, input.minimumVersion, input.recommendedVersion, input.storeUrl, actorUserId]
    );
    const after = { platform, ...input };
    await writeAudit(tx, { action: 'settings.mobile_version_changed', actorUserId, entityType: 'mobile_version_settings', entityId: platform, before, after, ctx });
    return after;
  });
  clearVersionCache();
  return saved;
}
