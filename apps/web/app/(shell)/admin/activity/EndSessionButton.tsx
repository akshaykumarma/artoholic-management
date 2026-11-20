'use client';
import { useRouter } from 'next/navigation';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';

export default function EndSessionButton({ id }: { id: string }) {
  const router = useRouter();
  return <button type="button" className="secondary" onClick={() => api.post(`/api/v1/admin/activity/sessions/${id}/end`, {}).then(() => router.refresh())}>{t('adm.endSession')}</button>;
}
