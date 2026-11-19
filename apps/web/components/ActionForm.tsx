'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError, t } from '@artoholic/shared';

/** Small form wrapper: runs an async action, shows its message, refreshes server data on success. */
export default function ActionForm({ title, submit, onSubmit, children, success }: {
  title?: string; submit: string; success?: string; children: ReactNode; onSubmit: () => Promise<string | void>;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  async function handle(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const text = await onSubmit();
      setMsg({ text: text || success || t('versions.saved') });
      router.refresh();
    } catch (err) {
      const fields = err instanceof ApiClientError ? (err.details?.fields as Record<string, string> | undefined) : undefined;
      setMsg({ text: fields ? Object.values(fields).join(' · ') : err instanceof Error ? err.message : t('error.INTERNAL'), error: true });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form method="post" onSubmit={handle} className="card" aria-label={title ?? submit}>
      {title ? <h3>{title}</h3> : null}
      {children}
      <button type="submit" disabled={busy}>{submit}</button>
      {msg ? <p role={msg.error ? 'alert' : 'status'} className={msg.error ? 'error' : undefined}>{msg.text}</p> : null}
    </form>
  );
}
