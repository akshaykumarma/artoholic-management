'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';

/** Step 1: ask for a code. Step 2: enter code and new password (002 US3). */
export default function ForgotForm() {
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post('/api/v1/auth/forgot', { identifier });
      setSent(true);
      setMsg(t('forgot.sent'));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t('error.INTERNAL'));
    }
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post('/api/v1/auth/reset', { identifier, code, newPassword: password });
      setDone(true);
      setMsg(t('reset.done'));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t('error.INTERNAL'));
    }
  }

  if (done) {
    return (
      <section className="card">
        <p role="status">{msg}</p>
        <Link href="/sign-in">{t('signIn.title')}</Link>
      </section>
    );
  }

  return (
    <form method="post" className="card" onSubmit={sent ? reset : send} aria-labelledby="forgot-title">
      <h1 id="forgot-title">{t('forgot.title')}</h1>
      <p className="muted">{t('forgot.body')}</p>
      <label htmlFor="identifier">{t('signIn.identifier')}</label>
      <input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required readOnly={sent} />
      {sent ? (
        <>
          <label htmlFor="code">{t('reset.code')}</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
          <label htmlFor="new-password">{t('reset.newPassword')}</label>
          <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit">{t('reset.submit')}</button>
        </>
      ) : (
        <button type="submit">{t('forgot.submit')}</button>
      )}
      {msg ? <p role="status">{msg}</p> : null}
    </form>
  );
}
