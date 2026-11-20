'use client';
import { useState, type InputHTMLAttributes } from 'react';
import { t } from '@artoholic/shared';

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

/** A password box with an eye button that shows or hides what was typed. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { id: string }) {
  const [shown, setShown] = useState(false);
  const label = shown ? t('password.hide') : t('password.show');
  return (
    <div className="password-field">
      <input {...props} type={shown ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      {/* Name comes from hidden text (not aria-label) so "Password" labels stay unique for screen readers and tests. */}
      <button type="button" className="eye" aria-controls={props.id} title={label} onClick={() => setShown((s) => !s)}>
        <EyeIcon off={shown} />
        <span className="sr-only">{label}</span>
      </button>
    </div>
  );
}
