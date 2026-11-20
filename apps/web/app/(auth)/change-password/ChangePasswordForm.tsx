'use client';
import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiClientError, t, type MessageKey } from '@artoholic/shared';
import { api } from '@/lib/api';
import { PasswordInput } from '@/components/PasswordInput';

export default function ChangePasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/api/v1/auth/change-password', { currentPassword: current, newPassword: next });
      const back = params.get('returnTo');
      router.replace(back && back.startsWith('/') && !back.startsWith('//') ? back : '/');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'PASSWORD_POLICY') {
        const rules = (err.details?.rules as string[] | undefined) ?? [];
        setError(rules.map((r) => t(`password.rule.${r}` as MessageKey)).join(' · '));
      } else setError(err instanceof Error ? err.message : t('error.INTERNAL'));
    }
  }

  return (
    <form method="post" className="card" onSubmit={submit} aria-labelledby="change-title">
      <h1 id="change-title">{t('change.title')}</h1>
      <label htmlFor="current">{t('change.current')}</label>
      <PasswordInput id="current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      <label htmlFor="next">{t('change.new')}</label>
      <PasswordInput id="next" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
      <p className="muted">{[t('password.rule.length'), t('password.rule.notIdentifier'), t('password.rule.notCommon')].join(' · ')}</p>
      <button type="submit">{t('change.submit')}</button>
      {error ? <p role="alert" className="error">{error}</p> : null}
    </form>
  );
}
