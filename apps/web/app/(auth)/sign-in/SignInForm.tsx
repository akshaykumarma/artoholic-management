'use client';
import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiClientError, signInWebResponseSchema, t, formatDateTimeIST } from '@artoholic/shared';
import Link from 'next/link';
import { api } from '@/lib/api';

/** Only same-site relative paths are accepted as return targets. */
function safeReturn(path: string | null): string {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

export default function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.post('/api/v1/auth/sign-in', { identifier, password }, signInWebResponseSchema);
      const next = safeReturn(params.get('returnTo'));
      router.replace(user.mustChangePassword ? `/change-password?returnTo=${encodeURIComponent(next)}` : next);
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
    <form method="post" onSubmit={onSubmit} className="card" aria-labelledby="sign-in-title">
      <h1 id="sign-in-title">{t('signIn.title')}</h1>
      <label htmlFor="identifier">{t('signIn.identifier')}</label>
      <input id="identifier" name="username" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
      <label htmlFor="password">{t('signIn.password')}</label>
      <input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button type="submit" disabled={busy}>{busy ? t('signIn.signingIn') : t('signIn.submit')}</button>
      {error ? <p role="alert" className="error">{error}</p> : null}
      <p><Link href="/forgot">{t('signIn.forgot')}</Link></p>
    </form>
  );
}
