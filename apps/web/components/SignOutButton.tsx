'use client';
import { t } from '@artoholic/shared';
import { api } from '@/lib/api';

export default function SignOutButton() {
  async function signOut() {
    try {
      await api.post('/api/v1/auth/sign-out');
    } finally {
      window.location.assign('/sign-in');
    }
  }
  return (
    <button type="button" className="secondary" onClick={signOut}>
      {t('signOut')}
    </button>
  );
}
