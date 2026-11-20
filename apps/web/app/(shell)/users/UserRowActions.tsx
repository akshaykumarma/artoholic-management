'use client';
import { useCallback, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { t, type User } from '@artoholic/shared';
import { api } from '@/lib/api';
import Modal from '@/components/Modal';
import UserForm from '@/components/UserForm';
import { PasswordInput } from '@/components/PasswordInput';

type Open = null | 'edit' | 'reset' | 'deactivate' | 'reactivate';

/** Readable temporary password, e.g. "marigold-7342-tent". */
function generatePassword(): string {
  const words = ['marigold', 'saffron', 'jasmine', 'lotus', 'mandap', 'tent', 'stage', 'drape', 'lamp', 'garland', 'canopy', 'velvet'];
  const r = new Uint32Array(3);
  crypto.getRandomValues(r);
  return `${words[r[0]! % words.length]}-${1000 + (r[1]! % 9000)}-${words[r[2]! % words.length]}`;
}

export default function UserRowActions({ user, isSuperAdmin, isSelf }: { user: User; isSuperAdmin: boolean; isSelf: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const name = user.fullName;

  const close = useCallback(() => setOpen(null), []);
  function show(which: Open) {
    setPassword(which === 'reset' || which === 'reactivate' ? generatePassword() : '');
    setReason('');
    setError(null);
    setDone(null);
    setOpen(which);
  }

  async function submit(e: FormEvent, fn: () => Promise<unknown>, message?: string) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
      if (message) setDone(message);
      else setOpen(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.INTERNAL'));
    } finally {
      setBusy(false);
    }
  }

  const passwordField = (
    <>
      <label htmlFor={`pw-${user.id}`}>{t('users.tempPassword')}</label>
      <div className="row-inline">
        <PasswordInput id={`pw-${user.id}`} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" required />
        <button type="button" className="secondary" onClick={() => setPassword(generatePassword())}>{t('users.generate')}</button>
      </div>
    </>
  );

  return (
    <div className="row-actions">
      <button type="button" className="secondary small" onClick={() => show('edit')}>{t('users.edit')}</button>
      <button type="button" className="secondary small" onClick={() => show('reset')}>{t('users.resetPassword')}</button>
      {user.status === 'active' ? (
        isSelf ? null : <button type="button" className="danger small" onClick={() => show('deactivate')}>{t('users.deactivate')}</button>
      ) : (
        <button type="button" className="success small" onClick={() => show('reactivate')}>{t('users.reactivate')}</button>
      )}

      {open === 'edit' ? (
        <Modal title={t('users.editTitle', { name })} onClose={close}>
          <UserForm user={user} isSuperAdmin={isSuperAdmin} onSaved={() => { router.refresh(); setOpen(null); }} />
        </Modal>
      ) : null}

      {open === 'reset' ? (
        <Modal title={t('users.resetTitle', { name })} onClose={close}>
          {done ? (
            <>
              <p role="status" className="success-note">{done}</p>
              <p><strong className="mono">{password}</strong></p>
              <div className="modal-foot"><button type="button" onClick={close}>{t('common.close')}</button></div>
            </>
          ) : (
            <form onSubmit={(e) => submit(e, () => api.post(`/api/v1/users/${user.id}/temporary-password`, { temporaryPassword: password }), t('users.resetDone', { name }))}>
              <p className="muted">{t('users.resetHint')}</p>
              {passwordField}
              {error ? <p role="alert" className="error">{error}</p> : null}
              <div className="modal-foot">
                <button type="button" className="secondary" onClick={close}>{t('common.cancel')}</button>
                <button type="submit" disabled={busy}>{t('users.resetPassword')}</button>
              </div>
            </form>
          )}
        </Modal>
      ) : null}

      {open === 'deactivate' ? (
        <Modal title={t('users.deactivateTitle', { name })} onClose={close}>
          <form onSubmit={(e) => submit(e, () => api.post(`/api/v1/users/${user.id}/deactivate`, { reason }))}>
            <p className="muted">{t('users.deactivateHint')}</p>
            <label htmlFor={`reason-${user.id}`}>{t('users.deactivateReason')}</label>
            <input id={`reason-${user.id}`} value={reason} onChange={(e) => setReason(e.target.value)} required />
            {error ? <p role="alert" className="error">{error}</p> : null}
            <div className="modal-foot">
              <button type="button" className="secondary" onClick={close}>{t('common.cancel')}</button>
              <button type="submit" className="danger" disabled={busy}>{t('users.deactivate')}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {open === 'reactivate' ? (
        <Modal title={t('users.reactivateTitle', { name })} onClose={close}>
          {done ? (
            <>
              <p role="status" className="success-note">{done}</p>
              <p><strong className="mono">{password}</strong></p>
              <div className="modal-foot"><button type="button" onClick={close}>{t('common.close')}</button></div>
            </>
          ) : (
            <form onSubmit={(e) => submit(e, () => api.post(`/api/v1/users/${user.id}/reactivate`, { temporaryPassword: password }), t('users.resetDone', { name }))}>
              <p className="muted">{t('users.reactivateHint')}</p>
              {passwordField}
              {error ? <p role="alert" className="error">{error}</p> : null}
              <div className="modal-foot">
                <button type="button" className="secondary" onClick={close}>{t('common.cancel')}</button>
                <button type="submit" className="success" disabled={busy}>{t('users.reactivate')}</button>
              </div>
            </form>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
