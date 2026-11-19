import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '@artoholic/shared';
import { colors } from '../theme';

export const BIOMETRIC_KEY = 'artoholic.biometric';
export const LAST_ACTIVE_KEY = 'artoholic.lastActiveAt';
const LOCK_AFTER_MS = 5 * 60_000;
const MAX_FAILURES = 3;

export async function biometricsAvailable(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

/**
 * Hides the app behind a fingerprint/face prompt when it returns after more than 5 minutes in the
 * background (002 US5). It only unlocks an existing session; 3 failures fall back to the password.
 */
export function BiometricGate({ children, onPasswordFallback }: { children: ReactNode; onPasswordFallback: () => void }) {
  const [locked, setLocked] = useState<boolean | null>(null);
  const failures = useRef(0);

  const shouldLock = useCallback(async () => {
    if ((await AsyncStorage.getItem(BIOMETRIC_KEY)) !== 'on' || !(await biometricsAvailable())) return false;
    const last = Number((await AsyncStorage.getItem(LAST_ACTIVE_KEY)) ?? 0);
    return Date.now() - last > LOCK_AFTER_MS;
  }, []);

  useEffect(() => {
    shouldLock().then(setLocked);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void shouldLock().then((l) => l && setLocked(true));
      } else {
        void AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
      }
    });
    return () => sub.remove();
  }, [shouldLock]);

  async function unlock() {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: t('biometric.prompt') });
    if (result.success) {
      failures.current = 0;
      await AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
      setLocked(false);
      return;
    }
    failures.current += 1;
    if (failures.current >= MAX_FAILURES) {
      failures.current = 0;
      setLocked(false);
      onPasswordFallback();
    }
  }

  if (locked === null) return null;
  if (!locked) return <>{children}</>;
  return (
    <View style={styles.wrap}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('biometric.prompt')} style={styles.button} onPress={unlock}>
        <Text style={styles.text}>{t('biometric.prompt')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.link} onPress={onPasswordFallback}>
        <Text>{t('biometric.usePassword')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'stretch', padding: 24, backgroundColor: colors.bg },
  button: { minHeight: 56, borderRadius: 12, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  text: { color: '#fff', fontSize: 17, fontWeight: '600' },
  link: { marginTop: 16, minHeight: 48, justifyContent: 'center', alignItems: 'center' }
});
