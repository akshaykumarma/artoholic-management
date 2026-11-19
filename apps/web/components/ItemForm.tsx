'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Decimal from 'decimal.js';
import { itemSchema, t, TRACKING_TYPES, type Category, type Item, type TrackingType, type Unit } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from './ActionForm';

/** Create (no `item`) or edit an item. Tracking type and unit lock after the first stock movement. */
export default function ItemForm({ item, categories, units }: { item?: Item; categories: Category[]; units: Unit[] }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: item?.name ?? '', code: item?.code ?? '', categoryId: item?.categoryId ?? '', trackingType: (item?.trackingType ?? 'counted') as TrackingType,
    unitCode: item?.unitCode ?? '', value: item ? new Decimal(item.replacementValuePaise).div(100).toFixed(2) : '', minimumStock: item?.minimumStock ?? '',
    minimumUsableLength: item?.minimumUsableLength ?? '', description: item?.description ?? '', notes: item?.notes ?? ''
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const active = categories.filter((c) => c.status === 'active');
  const label = (c: Category) => (c.parentId ? `${categories.find((p) => p.id === c.parentId)?.name ?? ''} › ${c.name}` : c.name);

  async function save() {
    const body = {
      name: v.name, categoryId: v.categoryId, description: v.description, notes: v.notes,
      replacementValuePaise: new Decimal(v.value || '0').mul(100).toNumber(),
      minimumStock: v.minimumStock || null, ...(v.trackingType === 'cut' ? { minimumUsableLength: v.minimumUsableLength || null } : {}),
      ...(v.code && v.code !== item?.code ? { code: v.code } : {})
    };
    const saved = item
      ? await api.request('PATCH', `/api/v1/catalogue/items/${item.id}`, { body, headers: { 'if-match': item.updatedAt }, schema: itemSchema })
      : await api.post('/api/v1/catalogue/items', { ...body, trackingType: v.trackingType, unitCode: v.trackingType === 'counted' ? null : v.unitCode }, itemSchema);
    router.push(`/inventory/items/${saved.id}`);
  }

  return (
    <ActionForm submit={t('inv.save')} onSubmit={save}>
      <label htmlFor="name">{t('inv.name')}</label>
      <input id="name" value={v.name} onChange={set('name')} required />
      <label htmlFor="code">{t('inv.code')}</label>
      <input id="code" value={v.code} onChange={set('code')} placeholder={t('inv.codeHint')} />
      <label htmlFor="category">{t('inv.category')}</label>
      <select id="category" value={v.categoryId} onChange={set('categoryId')} required style={{ minHeight: 44, width: '100%' }}>
        <option value="">{t('inv.none')}</option>
        {active.map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
      </select>
      {item ? null : (
        <>
          <label htmlFor="tracking">{t('inv.tracking')}</label>
          <select id="tracking" value={v.trackingType} onChange={set('trackingType')} style={{ minHeight: 44, width: '100%' }}>
            {TRACKING_TYPES.map((tt) => <option key={tt} value={tt}>{t(`inv.tracking.${tt}`)}</option>)}
          </select>
          {v.trackingType === 'counted' ? null : (
            <>
              <label htmlFor="unit">{t('inv.unit')}</label>
              <select id="unit" value={v.unitCode} onChange={set('unitCode')} required style={{ minHeight: 44, width: '100%' }}>
                <option value="">{t('inv.none')}</option>
                {units.filter((u) => u.status === 'active').map((u) => <option key={u.code} value={u.code}>{`${u.code} — ${u.name}`}</option>)}
              </select>
            </>
          )}
        </>
      )}
      <label htmlFor="value">{t('inv.replacementValue')}</label>
      <input id="value" inputMode="decimal" value={v.value} onChange={set('value')} />
      <label htmlFor="min">{t('inv.minimumStock')}</label>
      <input id="min" inputMode="decimal" value={v.minimumStock} onChange={set('minimumStock')} />
      {v.trackingType === 'cut' ? (
        <>
          <label htmlFor="minlen">{t('inv.minimumUsableLength')}</label>
          <input id="minlen" inputMode="decimal" value={v.minimumUsableLength} onChange={set('minimumUsableLength')} />
        </>
      ) : null}
      <label htmlFor="desc">{t('inv.description')}</label>
      <input id="desc" value={v.description} onChange={set('description')} />
      <label htmlFor="notes">{t('inv.notes')}</label>
      <input id="notes" value={v.notes} onChange={set('notes')} />
    </ActionForm>
  );
}
