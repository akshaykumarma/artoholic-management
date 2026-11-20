'use client';
import { useState } from 'react';
import { RELEASE_CHECKS, STORE_STATUSES, t, type MessageKey } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

/** Without an id: record a new release. With one: tick a check or change the store status. */
export default function ReleaseForms({ releaseId }: { releaseId?: string }) {
  const [n, setN] = useState({ platform: 'android', version: '', buildNumber: '', notes: '' });
  const [c, setC] = useState({ check: RELEASE_CHECKS[0] as string, device: '', passed: true });
  const [s, setS] = useState({ storeStatus: 'in_review', rejectionReason: '' });
  if (!releaseId) {
    return (
      <ActionForm title={t('rel.new')} submit={t('rel.new')} onSubmit={() => api.post('/api/v1/admin/releases', { ...n, buildNumber: Number(n.buildNumber) }).then(() => undefined)}>
        <label htmlFor="r-platform">{t('rel.platform')}</label>
        <select id="r-platform" value={n.platform} onChange={(e) => setN({ ...n, platform: e.target.value })}><option value="android">{'Android'}</option><option value="ios">{'iOS'}</option></select>
        <label htmlFor="r-version">{t('rel.version')}</label>
        <input id="r-version" value={n.version} onChange={(e) => setN({ ...n, version: e.target.value })} />
        <label htmlFor="r-build">{t('rel.build')}</label>
        <input id="r-build" inputMode="numeric" value={n.buildNumber} onChange={(e) => setN({ ...n, buildNumber: e.target.value })} />
        <label htmlFor="r-notes">{t('rel.notes')}</label>
        <textarea id="r-notes" value={n.notes} onChange={(e) => setN({ ...n, notes: e.target.value })} />
      </ActionForm>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <ActionForm submit={t('rel.checks')} onSubmit={() => api.post(`/api/v1/admin/releases/${releaseId}/checks`, c).then(() => undefined)}>
        <select aria-label={t('rel.checks')} value={c.check} onChange={(e) => setC({ ...c, check: e.target.value })}>
          {RELEASE_CHECKS.map((k) => <option key={k} value={k}>{t(`rel.check.${k}` as MessageKey)}</option>)}
        </select>
        <input aria-label={t('rel.device')} placeholder={t('rel.device')} value={c.device} onChange={(e) => setC({ ...c, device: e.target.value })} />
        <label style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={c.passed} onChange={(e) => setC({ ...c, passed: e.target.checked })} style={{ width: 20, minHeight: 20 }} />{t('rel.pass')}
        </label>
      </ActionForm>
      <ActionForm submit={t('rel.setStatus')} onSubmit={() => api.patch(`/api/v1/admin/releases/${releaseId}`, { storeStatus: s.storeStatus, rejectionReason: s.rejectionReason || undefined }).then(() => undefined)}>
        <select aria-label={t('rel.status')} value={s.storeStatus} onChange={(e) => setS({ ...s, storeStatus: e.target.value })}>
          {STORE_STATUSES.map((x) => <option key={x} value={x}>{t(`rel.status.${x}` as MessageKey)}</option>)}
        </select>
        {s.storeStatus === 'rejected' ? <input aria-label={t('rel.reason')} placeholder={t('rel.reason')} value={s.rejectionReason} onChange={(e) => setS({ ...s, rejectionReason: e.target.value })} /> : null}
      </ActionForm>
    </div>
  );
}
