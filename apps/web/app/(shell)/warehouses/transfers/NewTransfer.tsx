'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

type Opt = { id: string; label: string };

export default function NewTransfer({ from, to, items }: { from: Opt[]; to: Opt[]; items: Opt[] }) {
  const router = useRouter();
  const [fromId, setFrom] = useState(from[0]?.id ?? '');
  const [toId, setTo] = useState(to.find((w) => w.id !== from[0]?.id)?.id ?? '');
  const [lines, setLines] = useState([{ itemId: items[0]?.id ?? '', quantity: '' }]);
  const [notes, setNotes] = useState('');
  const set = (i: number, k: 'itemId' | 'quantity', v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  async function save() {
    const r = await api.post<{ id: string }>('/api/v1/transfers', { fromWarehouseId: fromId, toWarehouseId: toId, notes, lines: lines.filter((l) => l.quantity) });
    router.push(`/warehouses/transfers/${r.id}`);
  }
  return (
    <ActionForm title={t('tr.new')} submit={t('tr.create')} onSubmit={save}>
      <label htmlFor="tr-from">{t('tr.from')}</label>
      <select id="tr-from" value={fromId} onChange={(e) => setFrom(e.target.value)}>{from.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select>
      <label htmlFor="tr-to">{t('tr.to')}</label>
      <select id="tr-to" value={toId} onChange={(e) => setTo(e.target.value)}>{to.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select>
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <div style={{ flex: 2 }}>
            <label htmlFor={`tr-item-${i}`}>{t('tr.item')}</label>
            <select id={`tr-item-${i}`} value={l.itemId} onChange={(e) => set(i, 'itemId', e.target.value)}>{items.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor={`tr-qty-${i}`}>{t('wh.quantity')}</label>
            <input id={`tr-qty-${i}`} inputMode="decimal" value={l.quantity} onChange={(e) => set(i, 'quantity', e.target.value)} />
          </div>
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => setLines((ls) => [...ls, { itemId: items[0]?.id ?? '', quantity: '' }])}>{t('inv.add')}</button>
      <label htmlFor="tr-notes">{t('tr.notes')}</label>
      <input id="tr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
    </ActionForm>
  );
}
