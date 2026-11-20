import type { AdminStatus } from '@artoholic/shared';
import { runChecks, overallStatus } from './checks';
import { getVersionSettings } from '../versions/settings';
import { extendedStatus } from './extended';

export async function getAdminStatus(): Promise<AdminStatus> {
  const parts = await runChecks();
  return {
    overall: overallStatus(parts),
    platformVersion: process.env.APP_VERSION ?? '0.1.0',
    checkedAt: new Date().toISOString(),
    parts,
    mobileVersions: [await getVersionSettings('android'), await getVersionSettings('ios')],
    extended: await extendedStatus()
  };
}
