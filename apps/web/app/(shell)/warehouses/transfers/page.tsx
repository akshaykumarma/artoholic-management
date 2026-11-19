import Link from 'next/link';
import { t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listTransfers } from '@/server/warehouses/transfers';
import { listActiveWarehouses, listWarehouses } from '@/server/warehouses/basic';
import { listItems } from '@/server/catalogue/items';
import NewTransfer from './NewTransfer';

export const dynamic = 'force-dynamic';

export default async function TransfersPage() {
  const auth = await requirePageAuth();
  if (!can(auth, 'stock.view')) return <Forbidden />;
  const transfers = await listTransfers(auth, {});
  const canMove = can(auth, 'stock.move');
  const warehouses = canMove ? (await listWarehouses(auth)).filter((w) => w.status === 'active') : [];
  const allWarehouses = canMove ? await listActiveWarehouses() : [];
  const items = canMove ? (await listItems({})).items : [];
  return (
    <>
      <section className="card">
        <p><Link href="/warehouses">{t('wh.backToList')}</Link></p>
        <h2>{t('tr.title')}</h2>
        <table>
          <thead><tr><th>{t('tr.number')}</th><th>{t('tr.from')}</th><th>{t('tr.to')}</th><th>{t('tr.lines')}</th><th>{t('tr.status')}</th></tr></thead>
          <tbody>
            {transfers.map((x) => (
              <tr key={x.id}>
                <td><Link href={`/warehouses/transfers/${x.id}`}>{x.number}</Link></td>
                <td>{x.fromWarehouseCode}</td>
                <td>{x.toWarehouseCode}</td>
                <td>{x.lineCount}</td>
                <td>{t(`tr.status.${x.status}` as MessageKey)}{x.shortfallPending ? ` · ${t('tr.shortfallPending')}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {canMove && warehouses.length ? (
        <NewTransfer
          from={warehouses.map((w) => ({ id: w.id, label: `${w.code} · ${w.name}` }))}
          to={allWarehouses.map((w) => ({ id: w.id, label: `${w.code} · ${w.name}` }))}
          items={items.map((i) => ({ id: i.id, label: `${i.code} · ${i.name}` }))}
        />
      ) : null}
    </>
  );
}
