import type { PoolClient } from 'pg';
import { compareVersions, RELEASE_CHECKS, type Release } from '@artoholic/shared';
import { getPool, withTransaction } from '../../db/client';
import { ApiError } from '../http/errors';
import { writeAudit } from '../audit/write';
import { now } from '../auth/clock';
import type { Authenticated } from '../auth/sessions';
import type { RequestContext } from '../http/context';

type Tx = Pick<PoolClient, 'query'>;

async function view(db: Tx, id: string): Promise<Release> {
  const { rows } = await db.query('SELECT * FROM app_releases WHERE id = $1', [id]);
  const r = rows[0];
  if (!r) throw new ApiError('NOT_FOUND');
  const { rows: checks } = await db.query(
    'SELECT c.check_key, c.passed, u.full_name, c.device, c.note, c.at FROM release_checks c JOIN users u ON u.id = c.tested_by WHERE c.release_id = $1', [id]
  );
  const mapped = checks.map((c) => ({ check: c.check_key, passed: c.passed, testedBy: c.full_name, device: c.device, note: c.note, at: new Date(c.at).toISOString() }));
  return {
    id: r.id, platform: r.platform, version: r.version, buildNumber: r.build_number, notes: r.notes, storeStatus: r.store_status, rejectionReason: r.rejection_reason,
    createdAt: new Date(r.created_at).toISOString(), liveAt: r.live_at ? new Date(r.live_at).toISOString() : null, checks: mapped,
    checklistComplete: RELEASE_CHECKS.every((k) => mapped.some((c) => c.check === k && c.passed))
  };
}

export async function listReleases(): Promise<Release[]> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM app_releases ORDER BY platform, build_number DESC');
  return Promise.all(rows.map((r) => view(pool, r.id)));
}

/** MAJOR.MINOR.PATCH with an always-increasing build number per platform (FR-003). */
export async function createRelease(auth: Authenticated, input: { platform: 'android' | 'ios'; version: string; buildNumber: number; notes: string }, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const { rows } = await tx.query<{ version: string; build_number: number }>('SELECT version, build_number FROM app_releases WHERE platform = $1 ORDER BY build_number DESC LIMIT 1 FOR UPDATE', [input.platform]);
    const last = rows[0];
    if (last && input.buildNumber <= last.build_number) throw new ApiError('VALIDATION_FAILED', { fields: { buildNumber: `Build numbers must increase (last was ${last.build_number})` } });
    if (last && compareVersions(input.version, last.version) < 0) throw new ApiError('VALIDATION_FAILED', { fields: { version: `Versions can't go backwards (last was ${last.version})` } });
    try {
      const ins = await tx.query<{ id: string }>('INSERT INTO app_releases (platform, version, build_number, notes, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [input.platform, input.version, input.buildNumber, input.notes, auth.user.id]);
      const after = await view(tx, ins.rows[0]!.id);
      await writeAudit(tx, { action: 'release.created', actorUserId: auth.user.id, entityType: 'app_release', entityId: after.id, after, ctx });
      return after;
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ApiError('VALIDATION_FAILED', { fields: { version: 'That version already exists on this platform' } });
      throw e;
    }
  });
}

export async function recordCheck(auth: Authenticated, id: string, input: { check: string; passed: boolean; device: string; note: string }, ctx: RequestContext) {
  await withTransaction(async (tx) => {
    await view(tx, id);
    await tx.query(
      `INSERT INTO release_checks (release_id, check_key, passed, tested_by, device, note, at) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (release_id, check_key) DO UPDATE SET passed = EXCLUDED.passed, tested_by = EXCLUDED.tested_by, device = EXCLUDED.device, note = EXCLUDED.note, at = EXCLUDED.at`,
      [id, input.check, input.passed, auth.user.id, input.device, input.note, now()]
    );
    await writeAudit(tx, { action: 'release.check_recorded', actorUserId: auth.user.id, entityType: 'app_release', entityId: id, after: input, ctx });
  });
  return view(getPool(), id);
}

/** Store status; a build goes live only with every check ticked (FR-002); a rejection records why (edge case). */
export async function setStoreStatus(auth: Authenticated, id: string, input: { storeStatus: 'internal' | 'in_review' | 'live' | 'rejected'; rejectionReason?: string }, ctx: RequestContext) {
  return withTransaction(async (tx) => {
    const before = await view(tx, id);
    if (input.storeStatus === 'live' && !before.checklistComplete) throw new ApiError('CHECKLIST_INCOMPLETE', { missing: RELEASE_CHECKS.filter((k) => !before.checks.some((c) => c.check === k && c.passed)) });
    if (input.storeStatus === 'rejected' && !input.rejectionReason?.trim()) throw new ApiError('VALIDATION_FAILED', { fields: { rejectionReason: 'Record why the store rejected the build' } });
    await tx.query('UPDATE app_releases SET store_status = $2, rejection_reason = $3, live_at = CASE WHEN $2 = \'live\' THEN COALESCE(live_at, $4) ELSE live_at END WHERE id = $1',
      [id, input.storeStatus, input.rejectionReason ?? null, now()]);
    const after = await view(tx, id);
    await writeAudit(tx, { action: 'release.status_changed', actorUserId: auth.user.id, entityType: 'app_release', entityId: id, before, after, ctx });
    return after;
  });
}

/** 011 R6: the minimum can only be raised to a version that is live on that platform's store. */
export async function assertVersionLive(db: Tx, platform: 'android' | 'ios', version: string) {
  const { rows } = await db.query<{ version: string }>("SELECT version FROM app_releases WHERE platform = $1 AND store_status = 'live'", [platform]);
  if (!rows.some((r) => compareVersions(r.version, version) >= 0)) throw new ApiError('VERSION_NOT_LIVE', { platform, version });
}
