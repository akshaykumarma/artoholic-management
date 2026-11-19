'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Category } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

export default function CategoryAdmin({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const tops = categories.filter((c) => !c.parentId);
  return (
    <>
      <section className="card">
        <h2>{t('inv.categories')}</h2>
        <ul>
          {tops.map((c) => (
            <li key={c.id}>
              {`${c.name}${c.status === 'archived' ? ' (archived)' : ''} `}
              {c.status === 'active' ? <button type="button" className="secondary" onClick={() => api.request('PATCH', `/api/v1/catalogue/categories/${c.id}`, { body: { status: 'archived' } }).then(() => router.refresh())}>{t('inv.archive')}</button> : null}
              <ul>{categories.filter((s) => s.parentId === c.id).map((s) => <li key={s.id}>{s.name}</li>)}</ul>
            </li>
          ))}
        </ul>
      </section>
      <ActionForm title={t('inv.addCategory')} submit={t('inv.add')} onSubmit={() => api.post('/api/v1/catalogue/categories', { name, parentId: parentId || null }).then(() => setName(''))}>
        <label htmlFor="cat-name">{t('inv.name')}</label>
        <input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="cat-parent">{t('inv.subcategoryOf')}</label>
        <select id="cat-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} style={{ minHeight: 44, width: '100%' }}>
          <option value="">{t('inv.none')}</option>
          {tops.filter((c) => c.status === 'active').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </ActionForm>
    </>
  );
}
