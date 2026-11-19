'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t, type EventStatus } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

export default function EventActions({ id, status, editable }: { id: string; status: EventStatus; editable: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  return (
    <section className="card">
      <p style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {editable ? <Link href={`/events/${id}/edit`}>{t('ev.edit')}</Link> : null}
      </p>
      {status === 'draft' ? (
        <ActionForm submit={t('ev.schedule')} onSubmit={() => api.post(`/api/v1/events/${id}/schedule`, {}).then(() => undefined)}><span /></ActionForm>
      ) : null}
      <ActionForm submit={t('ev.copy')} onSubmit={async () => {
        const c = await api.post<{ id: string }>(`/api/v1/events/${id}/copy`, {});
        router.push(`/events/${c.id}/edit`);
      }}><span /></ActionForm>
      {editable ? (
        <ActionForm title={t('ev.cancel')} submit={t('ev.cancel')} onSubmit={() => api.post(`/api/v1/events/${id}/cancel`, { reason }).then(() => undefined)}>
          <label htmlFor="cancel-reason">{t('ev.cancelReason')}</label>
          <input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </ActionForm>
      ) : null}
    </section>
  );
}
