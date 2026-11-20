'use client';
import { useState, type InputHTMLAttributes } from 'react';
import { t } from '@artoholic/shared';

/** A password box with a "Show password" button that reveals what was typed. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { id: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="password-field">
      <input {...props} type={shown ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button type="button" aria-controls={props.id} onClick={() => setShown((s) => !s)}>
        {shown ? t('password.hide') : t('password.show')}
      </button>
    </div>
  );
}
