import Link from 'next/link';
import { t } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { getWarehouse, listLocations } from '@/server/warehouses/service';
import { listUsers } from '@/server/users/service';
import { listItems } from '@/server/catalogue/items';
import WarehouseSettings from './WarehouseSettings';
import BulkBins from './BulkBins';
import LocationStatus from './LocationStatus';
import MoveStock from './MoveStock';

export const dynamic = 'force-dynamic';

export default async function WarehousePage({ params, searchParams }: { params: { id: string }; searchParams: { q?: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'stock.view')) return <Forbidden />;
  let w;
  try {
    w = await getWarehouse(auth, params.id);
  } catch {
    return <Forbidden />;
  }
  const q = searchParams.q?.trim() || undefined;
  const locations = await listLocations(auth, w.id, { q });
  const bins = w.binCount ? (await listLocations(auth, w.id, { q: `${w.code}-` })).filter((l) => l.isBin && l.status === 'active') : [];
  const managers = can(auth, 'warehouses.manage') ? (await listUsers({ role: 'store_manager', status: 'active' })).items : [];
  const items = can(auth, 'stock.move') ? (await listItems({})).items : [];
  return (
    <>
      <section className="card">
        <p><Link href="/warehouses">{t('wh.backToList')}</Link></p>
        <h2>{`${w.code} · ${w.name}`}</h2>
        <p>{[w.address, w.contactPhone, t('wh.bins', { n: w.binCount })].filter(Boolean).join(' · ')}</p>
        <p>{`${t('wh.layout')}: ${w.levels.join(' › ') || t('wh.noLevels')}`}</p>
        <p>{`${t('wh.storeManagers')}: ${w.storeManagers.map((s) => s.fullName).join(', ')}`}</p>
      </section>
      {can(auth, 'warehouses.manage') ? (
        <WarehouseSettings warehouse={w} managers={managers.map((m) => ({ id: m.id, fullName: m.fullName }))} />
      ) : null}
      {can(auth, 'locations.manage') && w.levels.length ? <BulkBins warehouseId={w.id} levels={w.levels} /> : null}
      {can(auth, 'stock.move') && bins.length ? (
        <MoveStock bins={bins.map((b) => ({ id: b.id, code: b.code }))} items={items.map((i) => ({ id: i.id, label: `${i.code} · ${i.name}` }))} />
      ) : null}
      <section className="card">
        <h3>{t('wh.locations')}</h3>
        <form method="get" role="search" style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="loc-q">{t('wh.search')}</label>
            <input id="loc-q" name="q" defaultValue={q ?? ''} placeholder={t('wh.findBin')} />
          </div>
          <button type="submit">{t('wh.searchButton')}</button>
        </form>
        <table>
          <thead><tr><th>{t('wh.code')}</th><th>{t('wh.status')}</th><th /></tr></thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>{l.isDefault ? `${l.code} (${t('wh.default')})` : l.isBin ? `${l.code} · ${t('wh.bin')}` : l.code}</td>
                <td>{l.status === 'active' ? '' : t('wh.archived')}</td>
                <td>{can(auth, 'locations.manage') && !l.isDefault ? <LocationStatus id={l.id} status={l.status} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
