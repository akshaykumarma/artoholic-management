import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createApiClient, meResponseSchema, signInMobileResponseSchema, RETURN_PATH_KEY, type ApiClient, type Me } from '@artoholic/shared';
import { API_URL, APP_VERSION, PLATFORM } from '../config';
import { tokenStore } from './token';
import { mobileDraftStore } from '../drafts';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthValue {
  status: Status;
  me: Me | null;
  api: ApiClient;
  signIn(username: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Forgets the session on this device only (biometric fallback). */
  forgetLocally(): Promise<void>;
  refresh(): Promise<void>;
  /** Screens report where the user is, so a session expiry can bring them back there. */
  markLocation(path: string): void;
  takeReturnPath(): Promise<string>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const location = useRef('/');

  const expire = useCallback(async () => {
    await tokenStore.clear();
    await mobileDraftStore.set(RETURN_PATH_KEY, location.current);
    setMe(null);
    setStatus('signedOut');
  }, []);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: API_URL,
        platform: PLATFORM,
        version: APP_VERSION,
        getToken: () => tokenStore.get(),
        onSessionExpired: () => void expire()
      }),
    [expire]
  );

  const refresh = useCallback(async () => {
    const m = await api.get('/api/v1/me', meResponseSchema);
    setMe(m);
    setStatus('signedIn');
  }, [api]);

  useEffect(() => {
    (async () => {
      const token = await tokenStore.get();
      if (!token) return setStatus('signedOut');
      try {
        await refresh();
      } catch {
        setStatus('signedOut');
      }
    })();
  }, [refresh]);

  const value: AuthValue = {
    status,
    me,
    api,
    refresh,
    async signIn(username, password) {
      const res = await api.post('/api/v1/auth/sign-in', { username, password }, signInMobileResponseSchema);
      await tokenStore.set(res.token);
      setMe(res.user);
      setStatus('signedIn');
    },
    async signOut() {
      try {
        await api.post('/api/v1/auth/sign-out');
      } catch {
        // signing out locally is enough if the server is unreachable
      }
      await tokenStore.clear();
      setMe(null);
      setStatus('signedOut');
    },
    async forgetLocally() {
      await tokenStore.clear();
      setMe(null);
      setStatus('signedOut');
    },
    markLocation(path) {
      location.current = path;
    },
    async takeReturnPath() {
      const p = await mobileDraftStore.get<string>(RETURN_PATH_KEY);
      await mobileDraftStore.remove(RETURN_PATH_KEY);
      return p ?? '/';
    }
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
