import { describe, it, expect } from 'vitest';
import { RELEASE_CHECKS } from '@artoholic/shared';
import { GET as listReleases, POST as createRelease } from '../../app/api/v1/admin/releases/route';
import { PATCH as patchRelease } from '../../app/api/v1/admin/releases/[id]/route';
import { POST as check } from '../../app/api/v1/admin/releases/[id]/checks/route';
import { PUT as putVersions } from '../../app/api/v1/admin/mobile-versions/[platform]/route';
import { POST as requestDeletion } from '../../app/api/v1/me/deletion-request/route';
import { GET as listDeletion } from '../../app/api/v1/admin/deletion-requests/route';
import { POST as complete } from '../../app/api/v1/admin/deletion-requests/[id]/complete/route';
import { GET as audit } from '../../app/api/v1/admin/audit/route';
import { GET as me } from '../../app/api/v1/me/route';
import { POST as registerPush } from '../../app/api/v1/me/push-registrations/route';
import { webSessionFor, mobileTokenFor, type WebSession } from '../session-helpers';
import { getPool } from '../../db/client';
import { makeReq } from '../request';

type As = WebSession['as'];
const release = async (as: As, body: Record<string, unknown>) => {
  const res = await createRelease(makeReq('POST', '/x', { ...as, body }));
  return { status: res.status, json: await res.json() };
};
const tickAll = async (as: As, id: string) => {
  for (const c of RELEASE_CHECKS) await check(makeReq('POST', '/x', { ...as, body: { check: c, passed: true, device: 'Pixel 4a, Android 9' } }), { params: { id } });
};
const versions = (as: As, platform: string, min: string) =>
  putVersions(makeReq('PUT', '/x', { ...as, body: { minimumVersion: min, recommendedVersion: min, storeUrl: 'https://apps.apple.com/app/artoholic' } }), { params: { platform } });

describe('releases (011 US2)', () => {
  it('versions follow MAJOR.MINOR.PATCH with increasing build numbers; live needs every check; rejections record why', async () => {
    const sa = await webSessionFor(['super_admin']);
    const admin = await webSessionFor(['admin']);
    const r1 = await release(sa.as, { platform: 'android', version: '1.0.0', buildNumber: 10, notes: 'First release' });
    expect(r1.status).toBe(201);
    expect((await release(sa.as, { platform: 'android', version: '1.0.1', buildNumber: 10, notes: 'x' })).status).toBe(400);
    expect((await release(sa.as, { platform: 'android', version: '1.0', buildNumber: 11, notes: 'x' })).status).toBe(400);
    expect((await release(sa.as, { platform: 'android', version: '0.9.0', buildNumber: 11, notes: 'x' })).status).toBe(400);
    expect((await release(admin.as, { platform: 'android', version: '1.1.0', buildNumber: 11, notes: 'x' })).status).toBe(403);
    const early = await patchRelease(makeReq('PATCH', '/x', { ...sa.as, body: { storeStatus: 'live' } }), { params: { id: r1.json.id } });
    expect((await early.json()).error.code).toBe('CHECKLIST_INCOMPLETE');
    await tickAll(sa.as, r1.json.id);
    const live = await (await patchRelease(makeReq('PATCH', '/x', { ...sa.as, body: { storeStatus: 'live' } }), { params: { id: r1.json.id } })).json();
    expect(live).toMatchObject({ storeStatus: 'live', checklistComplete: true });
    expect(live.liveAt).not.toBeNull();
    const ios = await release(sa.as, { platform: 'ios', version: '1.0.0', buildNumber: 1, notes: 'First iOS' });
    expect((await patchRelease(makeReq('PATCH', '/x', { ...sa.as, body: { storeStatus: 'rejected' } }), { params: { id: ios.json.id } })).status).toBe(400);
    expect((await patchRelease(makeReq('PATCH', '/x', { ...sa.as, body: { storeStatus: 'rejected', rejectionReason: 'Guideline 5.1.1: account deletion' } }), { params: { id: ios.json.id } })).status).toBe(200);
    expect((await (await listReleases(makeReq('GET', '/x', sa.as))).json()).items).toHaveLength(2);
  });
});

describe('retiring old versions (011 US3)', () => {
  it('the minimum is raised only to a version live on that store', async () => {
    const sa = await webSessionFor(['super_admin']);
    const a = await release(sa.as, { platform: 'android', version: '1.1.0', buildNumber: 20, notes: 'API change' });
    await tickAll(sa.as, a.json.id);
    await patchRelease(makeReq('PATCH', '/x', { ...sa.as, body: { storeStatus: 'live' } }), { params: { id: a.json.id } });
    const i = await release(sa.as, { platform: 'ios', version: '1.1.0', buildNumber: 20, notes: 'API change' });
    await patchRelease(makeReq('PATCH', '/x', { ...sa.as, body: { storeStatus: 'in_review' } }), { params: { id: i.json.id } });
    expect((await versions(sa.as, 'android', '1.1.0')).status).toBe(200);
    const blocked = await versions(sa.as, 'ios', '1.1.0');
    expect((await blocked.json()).error.code).toBe('VERSION_NOT_LIVE');
    expect((await versions(sa.as, 'ios', '0.0.0')).status).toBe(200);
  });
});

describe('account deletion (011 US5)', () => {
  it('Admins are told; completion pseudonymises the person and keeps their past actions attributed', async () => {
    const sa = await webSessionFor(['super_admin']);
    const admin = await webSessionFor(['admin']);
    const em = await webSessionFor(['event_manager']);
    await getPool().query("UPDATE users SET full_name = 'Meera Iyer', phone_e164 = '+919812345678', email = 'meera@example.com' WHERE id = $1", [em.user.id]);
    const token = await mobileTokenFor(em.user.username, em.user.password);
    await registerPush(makeReq('POST', '/x', { platform: 'android', bearer: token, body: { expoToken: 'ExponentPushToken[meera]' } }));
    const req = await (await requestDeletion(makeReq('POST', '/x', { platform: 'android', bearer: token }))).json();
    expect(Date.parse(req.dueAt) - Date.now()).toBeGreaterThan(29 * 86_400_000);
    const again = await (await requestDeletion(makeReq('POST', '/x', { platform: 'android', bearer: token }))).json();
    expect(again).toMatchObject({ id: req.id, alreadyRequested: true });
    expect((await getPool().query("SELECT 1 FROM notification_outbox WHERE trigger = 'account.deletion_requested'")).rowCount).toBe(1);
    const list = (await (await listDeletion(makeReq('GET', '/x', admin.as))).json()).items;
    expect(list[0]).toMatchObject({ userName: 'Meera Iyer', status: 'pending' });
    expect((await listDeletion(makeReq('GET', '/x', em.as))).status).toBe(403);

    const done = await (await complete(makeReq('POST', '/x', { ...admin.as, body: {} }), { params: { id: req.id } })).json();
    expect(done.pseudonym).toMatch(/^Former user #/);
    const { rows } = await getPool().query('SELECT full_name, phone_e164, email, username, status, pseudonymised_at FROM users WHERE id = $1', [em.user.id]);
    expect(rows[0]).toMatchObject({ full_name: done.pseudonym, phone_e164: null, email: null, status: 'deactivated' });
    expect(rows[0].pseudonymised_at).not.toBeNull();
    expect((await me(makeReq('GET', '/x', { platform: 'android', bearer: token }))).status).toBe(401);
    expect((await getPool().query('SELECT 1 FROM push_registrations WHERE user_id = $1', [em.user.id])).rowCount).toBe(0);
    const log = (await (await audit(makeReq('GET', `/x?actorId=${em.user.id}`, sa.as))).json()).items;
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((a: { actor: string }) => a.actor === done.pseudonym)).toBe(true);
    expect((await complete(makeReq('POST', '/x', { ...admin.as, body: {} }), { params: { id: req.id } })).status).toBe(404);
  });
});
