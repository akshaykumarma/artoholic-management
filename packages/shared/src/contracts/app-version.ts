import { z } from 'zod';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export const semverSchema = z.string().regex(SEMVER, 'Use MAJOR.MINOR.PATCH, e.g. 1.2.0');

/** Numeric semver comparison: -1, 0 or 1. Unparseable versions sort lowest. */
export function compareVersions(a: string, b: string): number {
  const pa = SEMVER.exec(a)?.slice(1).map(Number) ?? [-1, -1, -1];
  const pb = SEMVER.exec(b)?.slice(1).map(Number) ?? [-1, -1, -1];
  for (let i = 0; i < 3; i++) {
    if (pa[i]! !== pb[i]!) return pa[i]! < pb[i]! ? -1 : 1;
  }
  return 0;
}

export const mobilePlatformSchema = z.enum(['android', 'ios']);

export const mobileVersionUpdateSchema = z
  .object({
    minimumVersion: semverSchema,
    recommendedVersion: semverSchema,
    storeUrl: z.string().url().refine((u) => u.startsWith('https://'), 'Store link must use https')
  })
  .refine((v) => compareVersions(v.recommendedVersion, v.minimumVersion) >= 0, {
    message: 'Recommended version must be at or above the minimum',
    path: ['recommendedVersion']
  });
export type MobileVersionUpdate = z.infer<typeof mobileVersionUpdateSchema>;

export const mobileVersionSettingSchema = z.object({
  platform: mobilePlatformSchema,
  minimumVersion: z.string(),
  recommendedVersion: z.string(),
  storeUrl: z.string()
});
export type MobileVersionSetting = z.infer<typeof mobileVersionSettingSchema>;

export const appVersionResponseSchema = mobileVersionSettingSchema;

export type UpdateDecision = 'required' | 'recommended' | 'ok';

/** What the app should do with its own version (US3). */
export function updateDecision(installed: string, s: Pick<MobileVersionSetting, 'minimumVersion' | 'recommendedVersion'>): UpdateDecision {
  if (compareVersions(installed, s.minimumVersion) < 0) return 'required';
  if (compareVersions(installed, s.recommendedVersion) < 0) return 'recommended';
  return 'ok';
}
