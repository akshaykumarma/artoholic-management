import Link from 'next/link';
import { t } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listWarehouses } from '@/server/warehouses/basic';
import NewWarehouse from './NewWarehouse';

export const dynamic = 'force-dynamic';

export default async function WarehousesPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'stock.view')) return <Forbidden />;
  const items = await listWarehouses(auth);
  return (
    <>
      <section className="card">
        <h2>{t('wh.title')}</h2>
        <p><Link href="/warehouses/transfers">{t('tr.title')}</Link></p>
        <table>
          <thead><tr><th>{t('wh.code')}</th><th>{t('wh.name')}</th><th>{t('wh.status')}</th></tr></thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id}>
                <td><Link href={`/warehouses/${w.id}`}>{w.code}</Link></td>
                <td>{w.name}</td>
                <td>{w.status === 'active' ? '' : t('wh.archived')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {can(auth, 'warehouses.manage') ? <NewWarehouse /> : null}
    </>
  );
}
