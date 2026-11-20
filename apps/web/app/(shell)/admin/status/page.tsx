import Link from 'next/link';
import { formatDateTimeIST, t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { getAdminStatus } from '@/server/health/status';
import MobileVersionsForm from './MobileVersionsForm';

export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'admin.status.view')) return <Forbidden />;
  const s = await getAdminStatus();
  return (
    <>
      <section className="card">
        <h2>{t('status.title')}</h2>
        <p>
          {t('status.overall')}: <span className={`badge ${s.overall}`} data-testid="overall">{t(`status.${s.overall}` as MessageKey)}</span>
        </p>
        <table>
          <tbody>
            {s.parts.map((p) => (
              <tr key={p.part}>
                <td>{t(`status.part.${p.part}` as MessageKey)}</td>
                <td><span className={`badge ${p.status}`} data-testid={`part-${p.part}`}>{t(`status.${p.status}` as MessageKey)}</span></td>
                <td className="muted">{t('status.checkedAt', { time: formatDateTimeIST(p.checkedAt) })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">{t('status.version')}: {s.platformVersion}</p>
      </section>
      {s.extended ? (
        <section className="card">
          <table>
            <tbody>
              <tr><td>{t('adm.queue')}</td><td data-testid="job-queue">{s.extended.jobQueue}</td></tr>
              <tr><td>{t('adm.failedMessages')}</td><td><Link href="/admin/messages?status=failed" data-testid="failed-messages">{s.extended.failedMessages24h}</Link></td></tr>
              <tr><td>{t('adm.storage')}</td><td>{`${(s.extended.storage.usedBytes / 1024 / 1024).toFixed(1)} MB${s.extended.storage.quotaBytes ? ` / ${(s.extended.storage.quotaBytes / 1024 ** 3).toFixed(0)} GB` : ''}`}</td></tr>
              <tr><td>{t('adm.lastBackup')}</td><td>{s.extended.lastBackup ? `${formatDateTimeIST(s.extended.lastBackup.at)} · ${s.extended.lastBackup.status}` : t('adm.never')}</td></tr>
              <tr><td>{t('adm.versions')}</td><td>{s.extended.appVersions.map((v) => `${v.platform} ${v.version}: ${v.sessions}`).join(' · ')}</td></tr>
            </tbody>
          </table>
        </section>
      ) : null}
      <MobileVersionsForm initial={s.mobileVersions} />
    </>
  );
}
