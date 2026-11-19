import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { t } from '@artoholic/shared';
import { useAuth } from '../../src/auth/AuthContext';

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
  return (
    <Stack screenOptions={{ headerTitleStyle: { color: '#4a5055' } }}>
      <Stack.Screen name="index" options={{ title: t('module.home') }} />
      <Stack.Screen name="reference/conventions" options={{ title: t('module.conventions') }} />
    </Stack>
  );
}
