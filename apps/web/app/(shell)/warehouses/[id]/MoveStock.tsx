'use client';
import { useState } from 'react';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

type Opt = { id: string; code: string };

/** Bin fields accept part of a code (004 US3); the datalist offers matches. */
export default function MoveStock({ bins, items }: { bins: Opt[]; items: Array<{ id: string; label: string }> }) {
  const [itemId, setItemId] = useState(items[0]?.id ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [qty, setQty] = useState('');
  const binId = (code: string) => bins.find((b) => b.code === code.trim().toUpperCase())?.id ?? '';
  return (
    <ActionForm title={t('wh.move')} submit={t('wh.move')} success={t('wh.moved')}
      onSubmit={() => api.post('/api/v1/stock/moves', { itemId, fromLocationId: binId(from), toLocationId: binId(to), quantity: qty, condition: 'available' }).then(() => undefined)}>
      <datalist id="bin-codes">{bins.map((b) => <option key={b.id} value={b.code} />)}</datalist>
      <label htmlFor="mv-item">{t('tr.item')}</label>
      <select id="mv-item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
        {items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
      </select>
      <label htmlFor="mv-from">{t('wh.from')}</label>
      <input id="mv-from" list="bin-codes" value={from} onChange={(e) => setFrom(e.target.value)} />
      <label htmlFor="mv-to">{t('wh.to')}</label>
      <input id="mv-to" list="bin-codes" value={to} onChange={(e) => setTo(e.target.value)} />
      <label htmlFor="mv-qty">{t('wh.quantity')}</label>
      <input id="mv-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
    </ActionForm>
  );
}
