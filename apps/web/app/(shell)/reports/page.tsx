import Link from 'next/link';
import { REPORTS, t } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'reports.run')) return <Forbidden />;
  return (
    <section className="card">
      <h2>{t('rpt.title')}</h2>
      {can(auth, 'reports.schedule') ? <p><Link href="/reports/schedules">{t('rpt.schedules')}</Link></p> : null}
      <ul>
        {Object.values(REPORTS).map((r) => <li key={r.id}><Link href={`/reports/${r.id}`}>{`${r.id} · ${r.title}`}</Link></li>)}
      </ul>
    </section>
  );
}
