'use client';
import { useState } from 'react';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

export default function NewWarehouse() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  return (
    <ActionForm title={t('inv.newWarehouse')} submit={t('inv.add')} onSubmit={() => api.post('/api/v1/warehouses', { code, name }).then(() => undefined)}>
      <label htmlFor="wh-code">{t('inv.code')}</label>
      <input id="wh-code" value={code} onChange={(e) => setCode(e.target.value)} />
      <label htmlFor="wh-name">{t('inv.name')}</label>
      <input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} />
    </ActionForm>
  );
}
