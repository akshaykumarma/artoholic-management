import Link from 'next/link';
import { formatQuantity, t } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { listItems } from '@/server/catalogue/items';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({ searchParams }: { searchParams: { q?: string; belowMinimum?: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'catalogue.view')) return <Forbidden />;
  const { items } = await listItems({ q: searchParams.q, belowMinimum: searchParams.belowMinimum === 'true' });
  return (
    <section className="card">
      <h2>{t('inv.items')}</h2>
      <p style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {can(auth, 'catalogue.manage') ? <Link href="/inventory/new">{t('inv.newItem')}</Link> : null}
        {can(auth, 'catalogue.manage') ? <Link href="/inventory/categories">{`${t('inv.categories')} · ${t('inv.units')}`}</Link> : null}
        {can(auth, 'catalogue.manage') ? <Link href="/inventory/import">{t('inv.import')}</Link> : null}
        {can(auth, 'stock.view') ? <Link href="/warehouses">{t('inv.warehouses')}</Link> : null}
        {can(auth, 'stock.approve') ? <Link href="/inventory/approvals">{t('inv.approvals')}</Link> : null}
      </p>
      <form method="get" role="search" style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="q">{t('inv.search')}</label>
          <input id="q" name="q" defaultValue={searchParams.q ?? ''} />
        </div>
        <label style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
          <input type="checkbox" name="belowMinimum" value="true" defaultChecked={searchParams.belowMinimum === 'true'} style={{ width: 20, minHeight: 20 }} />
          {t('inv.belowMinimum')}
        </label>
        <button type="submit">{t('inv.searchButton')}</button>
      </form>
      <table>
        <thead><tr><th>{t('inv.code')}</th><th>{t('inv.name')}</th><th>{t('inv.category')}</th><th>{t('inv.available')}</th><th>{t('inv.onHand')}</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>{i.code}</td>
              <td><Link href={`/inventory/items/${i.id}`}>{i.name}</Link></td>
              <td>{i.categoryName}</td>
              <td>{formatQuantity(i.available, i.unitCode)}</td>
              <td>{formatQuantity(i.onHand, i.unitCode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
