'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t, type User } from '@artoholic/shared';
import { api } from '@/lib/api';
import UserForm from '@/components/UserForm';

export default function UserDetail({ user, isSuperAdmin, isSelf }: { user: User; isSuperAdmin: boolean; isSelf: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [temp, setTemp] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setMsg(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t('error.INTERNAL'));
    }
  }

  return (
    <>
      <h3>{t('users.edit')}</h3>
      <UserForm key={user.updatedAt} user={user} isSuperAdmin={isSuperAdmin} onSaved={() => router.refresh()} />
      <h3>{t('users.setTempPassword')}</h3>
      <label htmlFor="temp">{t('users.tempPassword')}</label>
      <input id="temp" value={temp} onChange={(e) => setTemp(e.target.value)} />
      <button type="button" className="secondary" onClick={() => run(() => api.post(`/api/v1/users/${user.id}/temporary-password`, { temporaryPassword: temp }))}>
        {t('users.setTempPassword')}
      </button>
      {user.status === 'active' ? (
        isSelf ? null : (
          <>
            <h3>{t('users.deactivate')}</h3>
            <label htmlFor="reason">{t('users.deactivateReason')}</label>
            <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button type="button" onClick={() => run(() => api.post(`/api/v1/users/${user.id}/deactivate`, { reason }))}>{t('users.deactivate')}</button>
          </>
        )
      ) : (
        <button type="button" onClick={() => run(() => api.post(`/api/v1/users/${user.id}/reactivate`, { temporaryPassword: temp }))}>{t('users.reactivate')}</button>
      )}
      {msg ? <p role="alert" className="error">{msg}</p> : null}
    </>
  );
}
