'use client';
import { useRouter } from 'next/navigation';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';

export default function CompleteButton({ id }: { id: string }) {
  const router = useRouter();
  return <button type="button" onClick={() => api.post(`/api/v1/admin/deletion-requests/${id}/complete`, {}).then(() => router.refresh())}>{t('del.complete')}</button>;
}
