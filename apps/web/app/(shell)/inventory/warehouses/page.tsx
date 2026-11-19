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
        <h2>{t('inv.warehouses')}</h2>
        <table><tbody>{items.map((w) => <tr key={w.id}><td>{w.code}</td><td>{w.name}</td></tr>)}</tbody></table>
      </section>
      {can(auth, 'warehouses.manage') ? <NewWarehouse /> : null}
    </>
  );
}
