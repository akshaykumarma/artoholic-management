import Link from 'next/link';
import { formatDateTimeIST, formatMoney, formatQuantity, t, type Condition } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import ItemForm from '@/components/ItemForm';
import { itemView } from '@/server/catalogue/items';
import { listCategories } from '@/server/catalogue/categories';
import { listUnits } from '@/server/catalogue/units';
import { listWarehouses } from '@/server/warehouses/basic';
import StockActions from './StockActions';

export const dynamic = 'force-dynamic';
const SHOWN: Condition[] = ['available', 'reserved', 'out', 'damaged', 'in_transit', 'lost', 'written_off', 'consumed'];

export default async function ItemPage({ params }: { params: { id: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'catalogue.view')) return <Forbidden />;
  const v = await itemView(auth, params.id).catch(() => null);
  if (!v) return <section className="card"><p>{t('error.NOT_FOUND')}</p></section>;
  const u = v.item.unitCode;
  const warehouses = can(auth, 'stock.move') ? await listWarehouses(auth) : [];
  return (
    <>
      <section className="card">
        <p><Link href="/inventory">{t('inv.items')}</Link></p>
        <h2>{`${v.item.name} · ${v.item.code}`}</h2>
        <p className="muted">{[v.item.categoryName, t(`inv.tracking.${v.item.trackingType}`), formatMoney(v.item.replacementValuePaise)].join(' · ')}</p>
        {v.codes.length > 1 ? <p className="muted">{`${t('inv.formerCodes')}: ${v.codes.filter((c) => c.activeTo).map((c) => c.code).join(', ')}`}</p> : null}
        <p>{`${t('inv.onHand')}: ${formatQuantity(v.onHand, u)}`}</p>
        <table aria-label={t('inv.condition')}>
          <tbody>
            {SHOWN.filter((c) => (v.totals[c] ?? '0.000') !== '0.000').map((c) => (
              <tr key={c}><td>{t(`inv.condition.${c}`)}</td><td data-testid={`total-${c}`}>{formatQuantity(v.totals[c] ?? '0.000', u)}</td></tr>
            ))}
          </tbody>
        </table>
        <p>{`${t('inv.lastUsed')}: `}{v.lastUsedIn ? formatDateTimeIST(v.lastUsedIn.at) : t('inv.never')}</p>
      </section>
      <section className="card">
        <h3>{t('inv.byLocation')}</h3>
        <table>
          <tbody>
            {v.balances.map((b, i) => (
              <tr key={i}><td>{b.locationCode ?? '—'}</td><td>{b.pieceNumber ?? ''}</td><td>{t(`inv.condition.${b.condition}`)}</td><td>{formatQuantity(b.quantity, u)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      {v.pieces.length ? (
        <section className="card">
          <h3>{t('inv.pieces')}</h3>
          <table>
            <tbody>
              {v.pieces.map((p) => (
                <tr key={p.id}><td>{p.pieceNumber}</td><td>{formatQuantity(p.currentLength, u)}</td><td>{p.locationCode ?? '—'}</td><td>{p.belowMinimum ? t('inv.belowMin') : ''}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      <section className="card">
        <h3>{t('inv.damage')}</h3>
        <p>{[`${t('inv.damagedToDate')}: ${formatQuantity(v.damage.damagedToDate, u)}`, `${t('inv.currentlyDamaged')}: ${formatQuantity(v.damage.currentlyDamaged, u)}`, `${t('inv.writtenOff')}: ${formatQuantity(v.damage.writtenOff, u)}`, `${t('inv.lost')}: ${formatQuantity(v.damage.lost, u)}`].join(' · ')}</p>
      </section>
      {can(auth, 'stock.move') ? <StockActions view={v} warehouses={warehouses} /> : null}
      {can(auth, 'catalogue.manage') ? (
        <section>
          <h3>{t('users.edit')}</h3>
          <ItemForm item={v.item} categories={await listCategories()} units={await listUnits()} />
        </section>
      ) : null}
      <section className="card">
        <h3>{t('inv.history')}</h3>
        <table>
          <tbody>
            {v.history.map((h) => (
              <tr key={h.id}><td>{formatDateTimeIST(h.occurredAt)}</td><td>{h.type}</td><td>{formatQuantity(h.quantity, u)}</td><td>{[h.fromCondition, h.toCondition].filter(Boolean).join(' → ')}</td><td>{h.reason ?? ''}</td><td>{h.actor ?? ''}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
