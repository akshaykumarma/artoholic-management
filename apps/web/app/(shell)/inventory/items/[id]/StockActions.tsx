'use client';
import { useState } from 'react';
import { cutResultSchema, t, type ItemView, type Warehouse } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

/** Opening stock, corrections, cuts, write-offs and return-to-available for one item (003 US2–US6). */
export default function StockActions({ view, warehouses }: { view: ItemView; warehouses: Warehouse[] }) {
  const id = view.item.id;
  const binOptions = Array.from(new Map(view.balances.filter((b) => b.locationId).map((b) => [b.locationId!, b.locationCode!])).entries());
  const defaultBins = warehouses.filter((w) => w.defaultLocationId).map((w) => [w.defaultLocationId!, `${w.code}-DEFAULT`] as const);
  const allBins = Array.from(new Map([...binOptions, ...defaultBins]).entries());
  const [open, setOpen] = useState({ locationId: allBins[0]?.[0] ?? '', quantity: '', condition: 'available' });
  const [corr, setCorr] = useState({ locationId: allBins[0]?.[0] ?? '', change: '', reason: '', condition: 'available' });
  const [cut, setCut] = useState({ pieceId: view.pieces[0]?.id ?? '', length: '' });
  const [dmg, setDmg] = useState({ locationId: binOptions[0]?.[0] ?? '', quantity: '', reason: '' });
  const select = (value: string, onChange: (v: string) => void, opts: Array<readonly [string, string]>, id2: string) => (
    <select id={id2} value={value} onChange={(e) => onChange(e.target.value)} style={{ minHeight: 44, width: '100%' }}>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  return (
    <>
      <ActionForm title={t('inv.opening')} submit={t('inv.add')} onSubmit={() => api.post('/api/v1/stock/opening', { lines: [{ itemId: id, locationId: open.locationId, quantity: open.quantity, condition: open.condition }] }).then(() => undefined)}>
        <label htmlFor="o-loc">{t('inv.warehouse')}</label>
        {select(open.locationId, (x) => setOpen({ ...open, locationId: x }), allBins, 'o-loc')}
        <label htmlFor="o-qty">{t('inv.quantity')}</label>
        <input id="o-qty" inputMode="decimal" value={open.quantity} onChange={(e) => setOpen({ ...open, quantity: e.target.value })} />
      </ActionForm>
      <ActionForm title={t('inv.correct')} submit={t('inv.submit')} onSubmit={async () => {
        const r = await api.post<{ status: string }>('/api/v1/stock/corrections', { itemId: id, locationId: corr.locationId, condition: corr.condition, quantityChange: corr.change, reason: corr.reason });
        return r.status === 'pending' ? t('inv.requested') : t('inv.applied');
      }}>
        <label htmlFor="c-loc">{t('inv.warehouse')}</label>
        {select(corr.locationId, (x) => setCorr({ ...corr, locationId: x }), allBins, 'c-loc')}
        <label htmlFor="c-chg">{t('inv.change')}</label>
        <input id="c-chg" value={corr.change} onChange={(e) => setCorr({ ...corr, change: e.target.value })} placeholder={t('inv.correctHint')} />
        <label htmlFor="c-reason">{t('inv.reason')}</label>
        <input id="c-reason" value={corr.reason} onChange={(e) => setCorr({ ...corr, reason: e.target.value })} />
      </ActionForm>
      {view.item.trackingType === 'cut' && view.pieces.length ? (
        <ActionForm title={t('inv.cut')} submit={t('inv.cut')} onSubmit={async () => {
          const r = await api.post('/api/v1/stock/cuts', { pieceId: cut.pieceId, length: cut.length }, cutResultSchema);
          return t('inv.cutDone', { len: r.cutPiece.length, off: r.offcut.length, piece: r.offcut.pieceNumber });
        }}>
          <label htmlFor="cut-piece">{t('inv.pieces')}</label>
          {select(cut.pieceId, (x) => setCut({ ...cut, pieceId: x }), view.pieces.map((p) => [p.id, `${p.pieceNumber} (${p.currentLength})`] as const), 'cut-piece')}
          <label htmlFor="cut-len">{t('inv.cutLength')}</label>
          <input id="cut-len" inputMode="decimal" value={cut.length} onChange={(e) => setCut({ ...cut, length: e.target.value })} />
        </ActionForm>
      ) : null}
      {view.totals.damaged !== '0.000' ? (
        <ActionForm title={t('inv.damage')} submit={t('inv.writeOff')} success={t('inv.requested')} onSubmit={() => api.post('/api/v1/stock/write-offs', { itemId: id, locationId: dmg.locationId, quantity: dmg.quantity, reason: dmg.reason }).then(() => undefined)}>
          <label htmlFor="d-loc">{t('inv.warehouse')}</label>
          {select(dmg.locationId, (x) => setDmg({ ...dmg, locationId: x }), binOptions, 'd-loc')}
          <label htmlFor="d-qty">{t('inv.quantity')}</label>
          <input id="d-qty" inputMode="decimal" value={dmg.quantity} onChange={(e) => setDmg({ ...dmg, quantity: e.target.value })} />
          <label htmlFor="d-reason">{t('inv.reason')}</label>
          <input id="d-reason" value={dmg.reason} onChange={(e) => setDmg({ ...dmg, reason: e.target.value })} />
        </ActionForm>
      ) : null}
    </>
  );
}
