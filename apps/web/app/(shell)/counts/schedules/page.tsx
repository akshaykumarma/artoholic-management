import Link from 'next/link';
import { formatPlainDate, t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listSchedules } from '@/server/counts/schedules';
import ScopeForm from '../ScopeForm';
import { countOptions } from '../options';
import PauseButton from './PauseButton';

export const dynamic = 'force-dynamic';

export default async function SchedulesPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'counts.schedule')) return <Forbidden />;
  const items = await listSchedules();
  return (
    <>
      <section className="card">
        <p><Link href="/counts">{t('cnt.title')}</Link></p>
        <h2>{t('cnt.schedules')}</h2>
        <table>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{t(`cnt.freq.${s.frequency}` as MessageKey)}</td>
                <td>{s.status === 'paused' ? t('cnt.paused') : t('cnt.nextDue', { date: formatPlainDate(s.nextDueDate) })}</td>
                <td>{s.assignees.map((a) => a.fullName).join(', ')}</td>
                <td><PauseButton id={s.id} status={s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <ScopeForm mode="schedule" {...await countOptions()} />
    </>
  );
}
