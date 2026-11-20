import { formatDateTimeIST, t } from '@artoholic/shared';
import { requirePageAuth } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { retentionView } from '@/server/admin/retention';

export const dynamic = 'force-dynamic';

/** Each rule, its last run and what it removed (counts only) — 010 US6-3. */
export default async function RetentionPage() {
  const auth = await requirePageAuth();
  if (!auth.user.roles.includes('super_admin')) return <Forbidden />;
  const rules = await retentionView();
  return (
    <section className="card">
      <h2>{t('adm.retention')}</h2>
      <table>
        <thead><tr><th>{t('adm.rule')}</th><th>{t('adm.lastRun')}</th><th>{t('adm.removed')}</th></tr></thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.rule}>
              <td>{r.description}</td>
              <td>{r.lastRun ? `${formatDateTimeIST(r.lastRun.at)} · ${r.lastRun.status}${r.lastRun.detail ? ` · ${r.lastRun.detail}` : ''}` : r.rule === 'forever' ? '' : t('adm.never')}</td>
              <td>{r.lastRun ? r.lastRun.removed : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
