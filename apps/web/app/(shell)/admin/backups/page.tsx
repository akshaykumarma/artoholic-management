import { formatDateTimeIST, t } from '@artoholic/shared';
import { requirePageAuth } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listBackups } from '@/server/admin/backups';
import RestoreTestForm from './RestoreTestForm';

export const dynamic = 'force-dynamic';

const mb = (b: number | null) => (b === null ? '' : `${(b / 1024 / 1024).toFixed(1)} MB`);

export default async function BackupsPage() {
  const auth = await requirePageAuth();
  if (!auth.user.roles.includes('super_admin')) return <Forbidden />;
  const { backups, restoreTests } = await listBackups();
  return (
    <>
      <section className="card">
        <h2>{t('adm.backups')}</h2>
        <p className="muted">{t('adm.runbook')}</p>
        <table>
          <thead><tr><th>{t('adm.when')}</th><th>{t('adm.result')}</th><th>{t('adm.size')}</th><th>{t('adm.files')}</th><th>{t('adm.location')}</th></tr></thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.id}>
                <td>{formatDateTimeIST(b.startedAt)}</td>
                <td className={b.status === 'failed' ? 'error' : undefined}>{b.status}{b.error ? ` · ${b.error}` : ''}</td>
                <td>{mb(b.databaseBytes)}</td><td>{b.filesSynced ?? ''}</td><td>{b.location ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h3>{t('adm.restoreTests')}</h3>
        <table>
          <tbody>
            {restoreTests.map((r) => <tr key={r.id}><td>{formatDateTimeIST(r.performedAt)}</td><td>{r.by}</td><td>{r.result}</td><td>{r.notes}</td></tr>)}
          </tbody>
        </table>
      </section>
      <RestoreTestForm />
    </>
  );
}
