import Link from 'next/link';
import { formatQuantity, t, type MessageKey } from '@artoholic/shared';
import { requirePageAuth, can } from '@/lib/server-auth';
import Forbidden from '@/components/Forbidden';
import { getTransfer } from '@/server/warehouses/transfers';
import { binSuggestions } from '@/server/warehouses/service';
import TransferActions from './TransferActions';

export const dynamic = 'force-dynamic';

export default async function TransferPage({ params }: { params: { id: string } }) {
  const auth = await requirePageAuth();
  if (!can(auth, 'stock.view')) return <Forbidden />;
  let tr;
  try {
    tr = await getTransfer(auth, params.id);
  } catch {
    return <Forbidden />;
  }
  const binsFor = async (warehouseId: string) => {
    const out: Record<string, Array<{ id: string; code: string }>> = {};
    for (const l of tr.lines) {
      try {
        out[l.id] = (await binSuggestions(auth, warehouseId, l.itemId, undefined)).map((b) => ({ id: b.id, code: b.code }));
      } catch {
        out[l.id] = [];
      }
    }
    return out;
  };
  const sourceBins = tr.status === 'requested' ? await binsFor(tr.fromWarehouseId) : {};
  const destBins = tr.status === 'dispatched' ? await binsFor(tr.toWarehouseId) : {};
  return (
    <>
      <section className="card">
        <p><Link href="/warehouses/transfers">{t('tr.title')}</Link></p>
        <h2>{`${tr.number} · ${tr.fromWarehouseCode} → ${tr.toWarehouseCode}`}</h2>
        <p>{t(`tr.status.${tr.status}` as MessageKey)}{tr.notes ? ` · ${tr.notes}` : ''}</p>
        <table>
          <thead><tr><th>{t('tr.item')}</th><th>{t('tr.requestedQty')}</th><th>{t('tr.dispatched')}</th><th>{t('tr.received')}</th><th>{t('tr.missing')}</th></tr></thead>
          <tbody>
            {tr.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.itemName}</td>
                <td>{formatQuantity(l.requestedQty, null)}</td>
                <td>{l.dispatchedQty ? formatQuantity(l.dispatchedQty, null) : ''}</td>
                <td>{l.receivedQty ? formatQuantity(l.receivedQty, null) : ''}</td>
                <td>{l.missingQty && l.missingQty !== '0.000' ? `${formatQuantity(l.missingQty, null)}${l.shortfallDecision === 'pending' ? ` · ${t('tr.shortfallPending')}` : ''}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {can(auth, 'stock.move') || can(auth, 'stock.approve') ? (
        <TransferActions transfer={tr} sourceBins={sourceBins} destBins={destBins} canMove={can(auth, 'stock.move')} canApprove={can(auth, 'stock.approve')} />
      ) : null}
    </>
  );
}
