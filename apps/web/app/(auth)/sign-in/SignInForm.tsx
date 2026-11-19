'use client';
import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiClientError, signInWebResponseSchema, t, formatDateTimeIST } from '@artoholic/shared';
import { api } from '@/lib/api';

/** Only same-site relative paths are accepted as return targets. */
function safeReturn(path: string | null): string {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

export default function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/v1/auth/sign-in', { username, password }, signInWebResponseSchema);
      router.replace(safeReturn(params.get('returnTo')));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'SIGN_IN_LOCKED') {
        setError(t('error.SIGN_IN_LOCKED', { time: formatDateTimeIST(String(err.details?.retryAt)) }));
      } else {
        setError(err instanceof Error ? err.message : t('error.INTERNAL'));
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" aria-labelledby="sign-in-title">
      <h1 id="sign-in-title">{t('signIn.title')}</h1>
      <label htmlFor="username">{t('signIn.username')}</label>
      <input id="username" name="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      <label htmlFor="password">{t('signIn.password')}</label>
      <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button type="submit" disabled={busy}>{busy ? t('signIn.signingIn') : t('signIn.submit')}</button>
      {error ? <p role="alert" className="error">{error}</p> : null}
    </form>
  );
}
