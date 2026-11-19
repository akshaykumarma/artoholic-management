'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError, t } from '@artoholic/shared';
import { api } from '@/lib/api';

export default function LocationStatus({ id, status }: { id: string; status: 'active' | 'archived' }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  async function flip() {
    setErr(null);
    try {
      await api.patch(`/api/v1/locations/${id}`, { status: status === 'active' ? 'archived' : 'active' });
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : t('error.INTERNAL'));
    }
  }
  return (
    <>
      <button type="button" className="secondary" onClick={flip}>{status === 'active' ? t('wh.archive') : t('wh.reactivate')}</button>
      {err ? <span role="alert" className="error">{err}</span> : null}
    </>
  );
}
