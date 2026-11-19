import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appVersionResponseSchema, createApiClient, formatDateIST, updateDecision } from '@artoholic/shared';
import { API_URL, APP_VERSION, PLATFORM } from '../config';

export type VersionState = 'checking' | 'ok' | 'recommended' | 'required';
const PROMPT_KEY = 'artoholic.updatePromptDate';

const client = () => createApiClient({ baseUrl: API_URL, platform: PLATFORM, version: APP_VERSION });

/**
 * Checks the installed version on launch and whenever the app returns to the foreground (FR-031).
 * Below minimum → blocking; below recommended → a prompt at most once a day; unreachable → never blocks.
 */
export function useVersionCheck() {
  const [state, setState] = useState<VersionState>('checking');
  const [storeUrl, setStoreUrl] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const s = await client().get(`/api/v1/app-version?platform=${PLATFORM}`, appVersionResponseSchema);
      setStoreUrl(s.storeUrl);
      const d = updateDecision(APP_VERSION, s);
      if (d === 'recommended') {
        const today = formatDateIST(new Date());
        if ((await AsyncStorage.getItem(PROMPT_KEY)) === today) return setState('ok');
        await AsyncStorage.setItem(PROMPT_KEY, today);
      }
      setState(d);
    } catch {
      setState((prev) => (prev === 'required' ? prev : 'ok'));
    }
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  return { state, storeUrl, dismiss: () => setState('ok') };
}
