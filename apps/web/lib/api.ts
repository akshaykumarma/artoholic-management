'use client';
import { createApiClient } from '@artoholic/shared';

function readCookie(name: string): string | null {
  const m = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

export const api = createApiClient({
  baseUrl: '',
  platform: 'web',
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
  getCsrf: () => readCookie('csrf'),
  onSessionExpired: () => {
    const here = window.location.pathname + window.location.search;
    window.location.assign(`/sign-in?returnTo=${encodeURIComponent(here)}`);
  }
});
