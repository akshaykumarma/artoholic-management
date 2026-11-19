'use client';
import { useRouter } from 'next/navigation';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';

export default function Decide({ id }: { id: string }) {
  const router = useRouter();
  const go = (action: 'approve' | 'reject') => api.post(`/api/v1/stock/requests/${id}/${action}`, {}).then(() => router.refresh());
  return (
    <span style={{ display: 'flex', gap: 8 }}>
      <button type="button" onClick={() => go('approve')}>{t('inv.approve')}</button>
      <button type="button" className="secondary" onClick={() => go('reject')}>{t('inv.reject')}</button>
    </span>
  );
}
