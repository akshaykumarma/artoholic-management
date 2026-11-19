'use client';
import { useState } from 'react';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';
import ActionForm from '@/components/ActionForm';

export default function DamageDecision({ id }: { id: string }) {
  const [comment, setComment] = useState('');
  return (
    <>
      <ActionForm submit={t('dmg.approve')} success={t('dmg.decided')} onSubmit={() => api.post(`/api/v1/damage-reports/${id}/approve`, { comment: comment || undefined }).then(() => undefined)}>
        <label htmlFor="dmg-comment">{t('dmg.comment')}</label>
        <input id="dmg-comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      </ActionForm>
      <ActionForm submit={t('dmg.reject')} success={t('dmg.decided')} onSubmit={() => api.post(`/api/v1/damage-reports/${id}/reject`, { comment }).then(() => undefined)}><span /></ActionForm>
    </>
  );
}
