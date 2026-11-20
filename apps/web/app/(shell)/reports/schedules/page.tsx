import Link from 'next/link';
import { REPORTS, t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listSchedules } from '@/server/reports/schedules';
import { listUsers } from '@/server/users/service';
import ScheduleForm from './ScheduleForm';

export const dynamic = 'force-dynamic';

export default async function ReportSchedulesPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'reports.schedule')) return <Forbidden />;
  const items = await listSchedules();
  const admins = [...(await listUsers({ role: 'admin', status: 'active' })).items, ...(await listUsers({ role: 'super_admin', status: 'active' })).items];
  return (
    <>
      <section className="card">
        <p><Link href="/reports">{t('rpt.title')}</Link></p>
        <h2>{t('rpt.schedules')}</h2>
        <table>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{`${s.reportId} · ${REPORTS[s.reportId].title}`}</td>
                <td>{`${t(`rpt.freq.${s.frequency}` as MessageKey)} ${s.weekday ?? ''}${s.monthDay ?? ''} · ${s.timeIst} IST`}</td>
                <td>{s.recipients.map((r) => r.fullName).join(', ')}</td>
                <td>{s.lastRun ? t('rpt.lastRun', { status: s.lastRun.status }) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <ScheduleForm admins={[...new Map(admins.map((a) => [a.id, { id: a.id, label: a.fullName }])).values()]} />
    </>
  );
}
