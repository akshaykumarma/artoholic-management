'use client';
import { useState } from 'react';
import { t, type Transfer } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

type Bins = Record<string, Array<{ id: string; code: string }>>;

export default function TransferActions({ transfer, sourceBins, destBins, canMove, canApprove }: {
  transfer: Transfer; sourceBins: Bins; destBins: Bins; canMove: boolean; canApprove: boolean;
}) {
  const base = `/api/v1/transfers/${transfer.id}`;
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(transfer.lines.map((l) => [l.id, (transfer.status === 'requested' ? l.requestedQty : l.dispatchedQty ?? '0').replace(/\.?0+$/, '')])));
  const [bin, setBin] = useState<Record<string, string>>(() =>
    Object.fromEntries(transfer.lines.map((l) => [l.id, ((transfer.status === 'requested' ? sourceBins : destBins)[l.id] ?? [])[0]?.id ?? ''])));
  const [confirm, setConfirm] = useState(false);
  const lineFields = (bins: Bins) => transfer.lines.map((l) => (
    <div key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
      <div style={{ flex: 2 }}>
        <label htmlFor={`bin-${l.id}`}>{`${l.itemName} · ${transfer.status === 'requested' ? t('tr.fromBin') : t('tr.toBin')}`}</label>
        <select id={`bin-${l.id}`} value={bin[l.id]} onChange={(e) => setBin({ ...bin, [l.id]: e.target.value })}>
          {(bins[l.id] ?? []).map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
      </div>
      <div style={{ flex: 1 }}>
        <label htmlFor={`qty-${l.id}`}>{t('wh.quantity')}</label>
        <input id={`qty-${l.id}`} inputMode="decimal" value={qty[l.id]} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} />
      </div>
    </div>
  ));
  return (
    <>
      {canMove && transfer.status === 'requested' ? (
        <>
          <ActionForm title={t('tr.dispatch')} submit={t('tr.dispatch')} success={t('tr.done')}
            onSubmit={() => api.post(`${base}/dispatch`, { lines: transfer.lines.map((l) => ({ lineId: l.id, dispatchedQty: qty[l.id] || '0', fromLocationId: bin[l.id] })) }).then(() => undefined)}>
            {lineFields(sourceBins)}
          </ActionForm>
          <ActionForm submit={t('tr.cancel')} success={t('tr.done')} onSubmit={() => api.post(`${base}/cancel`, {}).then(() => undefined)}>
            <span />
          </ActionForm>
        </>
      ) : null}
      {canMove && transfer.status === 'dispatched' ? (
        <ActionForm title={t('tr.receive')} submit={t('tr.receive')} success={t('tr.done')}
          onSubmit={() => api.post(`${base}/receive`, {
            lines: transfer.lines.filter((l) => l.dispatchedQty && l.dispatchedQty !== '0.000').map((l) => ({ lineId: l.id, receivedQty: qty[l.id] || '0', toLocationId: bin[l.id] })),
            confirmMissing: confirm
          }).then(() => undefined)}>
          {lineFields(destBins)}
          <label style={{ fontWeight: 400, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ width: 20, minHeight: 20 }} />
            {t('tr.confirmMissing')}
          </label>
        </ActionForm>
      ) : null}
      {canApprove ? transfer.lines.filter((l) => l.shortfallDecision === 'pending').map((l) => (
        <section key={l.id} className="card" aria-label={`${t('tr.decision')} ${l.itemName}`}>
          <h3>{`${t('tr.decision')} · ${l.itemName} · ${l.missingQty}`}</h3>
          <ActionForm submit={t('tr.markLost')} success={t('tr.done')} onSubmit={() => api.post(`${base}/lines/${l.id}/shortfall`, { decision: 'lost' }).then(() => undefined)}><span /></ActionForm>
          <ActionForm submit={t('tr.returnToSource')} success={t('tr.done')} onSubmit={() => api.post(`${base}/lines/${l.id}/shortfall`, { decision: 'returned' }).then(() => undefined)}><span /></ActionForm>
        </section>
      )) : null}
    </>
  );
}
