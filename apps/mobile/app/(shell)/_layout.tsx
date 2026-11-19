import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { t } from '@artoholic/shared';
import { useAuth } from '../../src/auth/AuthContext';
import { BiometricGate } from '../../src/auth/BiometricGate';

export default function ShellLayout() {
  const auth = useAuth();
  const path = usePathname();
  useEffect(() => auth.markLocation(path), [path]); // eslint-disable-line react-hooks/exhaustive-deps
  if (auth.status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (auth.status === 'signedOut') return <Redirect href="/sign-in" />;
  // A temporary password must be changed before anything else (002 FR-008).
  if (auth.me?.mustChangePassword && path !== '/change-password') return <Redirect href="/change-password" />;
  return (
    <BiometricGate onPasswordFallback={() => void auth.forgetLocally()}>
      <Stack screenOptions={{ headerTitleStyle: { color: '#4a5055' } }}>
        <Stack.Screen name="index" options={{ title: t('module.home') }} />
        <Stack.Screen name="change-password" options={{ title: t('change.title'), headerBackVisible: false }} />
        <Stack.Screen name="reference/conventions" options={{ title: t('module.conventions') }} />
        <Stack.Screen name="users/index" options={{ title: t('users.title') }} />
        <Stack.Screen name="users/new" options={{ title: t('users.new') }} />
        <Stack.Screen name="users/[id]" options={{ title: t('users.title') }} />
        <Stack.Screen name="users/edit/[id]" options={{ title: t('users.edit') }} />
        <Stack.Screen name="settings/security" options={{ title: t('security.title') }} />
      </Stack>
    </BiometricGate>
  );
}
