'use client';
import { useRouter } from 'next/navigation';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';

export default function PauseButton({ id, status }: { id: string; status: 'active' | 'paused' }) {
  const router = useRouter();
  return (
    <button type="button" className="secondary" onClick={() => api.patch(`/api/v1/counts/schedules/${id}`, { status: status === 'active' ? 'paused' : 'active' }).then(() => router.refresh())}>
      {status === 'active' ? t('cnt.pause') : t('cnt.resume')}
    </button>
  );
}
