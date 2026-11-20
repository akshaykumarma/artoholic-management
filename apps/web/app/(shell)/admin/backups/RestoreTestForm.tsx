'use client';
import { useState } from 'react';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

export default function RestoreTestForm() {
  const [f, setF] = useState({ at: '', rpo: '', rto: '', result: 'passed', notes: '' });
  return (
    <ActionForm title={t('adm.recordTest')} submit={t('adm.recordTest')} onSubmit={() => api.post('/api/v1/admin/restore-tests', {
      performedAt: new Date(`${f.at}:00+05:30`).toISOString(), result: f.result, notes: f.notes,
      ...(f.rpo ? { rpoHours: Number(f.rpo) } : {}), ...(f.rto ? { rtoHours: Number(f.rto) } : {})
    }).then(() => undefined)}>
      <label htmlFor="rt-at">{t('adm.testDate')}</label>
      <input id="rt-at" type="datetime-local" value={f.at} onChange={(e) => setF({ ...f, at: e.target.value })} />
      <label htmlFor="rt-rpo">{t('adm.rpo')}</label>
      <input id="rt-rpo" inputMode="decimal" value={f.rpo} onChange={(e) => setF({ ...f, rpo: e.target.value })} />
      <label htmlFor="rt-rto">{t('adm.rto')}</label>
      <input id="rt-rto" inputMode="decimal" value={f.rto} onChange={(e) => setF({ ...f, rto: e.target.value })} />
      <label htmlFor="rt-result">{t('adm.result')}</label>
      <select id="rt-result" value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })}>
        <option value="passed">{t('adm.passed')}</option>
        <option value="failed">{t('adm.failed')}</option>
      </select>
      <label htmlFor="rt-notes">{t('adm.notes')}</label>
      <textarea id="rt-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
    </ActionForm>
  );
}
