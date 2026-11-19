'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';

export default function LineDecision({ lineId }: { lineId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const decide = (kind: 'approve' | 'reject') => api.post(`/api/v1/counts/lines/${lineId}/${kind}`, { reason })
    .then(() => router.refresh()).catch((e: unknown) => setErr(e instanceof Error ? e.message : t('error.INTERNAL')));
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      <input aria-label={t('cnt.reason')} value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: 140 }} />
      <button type="button" onClick={() => void decide('approve')}>{t('cnt.approve')}</button>
      <button type="button" className="secondary" onClick={() => void decide('reject')}>{t('cnt.reject')}</button>
      {err ? <span role="alert" className="error">{err}</span> : null}
    </div>
  );
}
