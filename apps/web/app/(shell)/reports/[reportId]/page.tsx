import Link from 'next/link';
import { REPORT_IDS, REPORTS, t, type ReportId } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listActiveWarehouses } from '@/server/warehouses/basic';
import { listCategories } from '@/server/catalogue/categories';
import ReportRunner from './ReportRunner';

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: { params: { reportId: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'reports.run') || !(REPORT_IDS as readonly string[]).includes(params.reportId)) return <Forbidden />;
  const def = REPORTS[params.reportId as ReportId];
  const options = {
    warehouseId: def.filters.includes('warehouseId') ? (await listActiveWarehouses()).map((w) => ({ id: w.id, label: w.code })) : [],
    categoryId: def.filters.includes('categoryId') ? (await listCategories()).map((c) => ({ id: c.id, label: c.name })) : []
  };
  return (
    <section className="card">
      <p><Link href="/reports">{t('rpt.title')}</Link></p>
      <h2>{`${def.id} · ${def.title}`}</h2>
      <ReportRunner def={def} options={options} />
    </section>
  );
}
