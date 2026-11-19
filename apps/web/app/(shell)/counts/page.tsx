import Link from 'next/link';
import { formatPlainDate, t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listSessions } from '@/server/counts/sessions';
import ScopeForm from './ScopeForm';
import { countOptions } from './options';

export const dynamic = 'force-dynamic';

export default async function CountsPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'counts.perform')) return <Forbidden />;
  const sessions = await listSessions(auth, {});
  const admin = can(auth, 'counts.schedule');
  return (
    <>
      <section className="card">
        <h2>{t('cnt.title')}</h2>
        {admin ? <p><Link href="/counts/schedules">{t('cnt.schedules')}</Link></p> : null}
        <h3>{t('cnt.sessions')}</h3>
        {sessions.length ? (
          <table>
            <thead><tr><th>{t('cnt.number')}</th><th>{t('cnt.due')}</th><th>{t('cnt.title')}</th><th>{t('ev.status')}</th><th /></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/counts/${s.id}`}>{s.number}</Link></td>
                  <td>{formatPlainDate(s.dueDate)}{s.overdue ? <strong className="error">{` · ${t('cnt.overdue')}`}</strong> : null}</td>
                  <td>{[s.scheduleName, t('cnt.progress', { counted: s.countedCount, total: s.lineCount }), s.notes].filter(Boolean).join(' · ')}</td>
                  <td>{t(`cnt.status.${s.status}` as MessageKey)}</td>
                  <td>{admin && s.status !== 'open' ? <Link href={`/counts/${s.id}/review`}>{t('cnt.review')}</Link> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">{t('cnt.none')}</p>}
      </section>
      {admin ? <ScopeForm mode="adhoc" {...await countOptions()} /> : null}
    </>
  );
}
