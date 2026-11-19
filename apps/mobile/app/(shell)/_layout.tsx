import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { registerForPush } from '../../src/push/register';
import { useNotificationTaps } from '../../src/push/handle';
import { t } from '@artoholic/shared';
import { useAuth } from '../../src/auth/AuthContext';
import { BiometricGate } from '../../src/auth/BiometricGate';

export default function ShellLayout() {
  const auth = useAuth();
  const path = usePathname();
  useEffect(() => auth.markLocation(path), [path]); // eslint-disable-line react-hooks/exhaustive-deps
  // Push: register this device once signed in; tapping a notification opens its record (008 FR-003).
  useEffect(() => {
    if (auth.status === 'signedIn') void registerForPush(auth.api).catch(() => undefined);
  }, [auth.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useNotificationTaps((p) => router.push(p as never));
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
        <Stack.Screen name="inventory/index" options={{ title: t('inv.items') }} />
        <Stack.Screen name="inventory/[id]" options={{ title: t('module.inventory') }} />
        <Stack.Screen name="warehouses/index" options={{ title: t('wh.title') }} />
        <Stack.Screen name="warehouses/move" options={{ title: t('wh.move') }} />
        <Stack.Screen name="warehouses/transfers/index" options={{ title: t('tr.title') }} />
        <Stack.Screen name="warehouses/transfers/[id]" options={{ title: t('tr.title') }} />
        <Stack.Screen name="events/index" options={{ title: t('ev.title') }} />
        <Stack.Screen name="events/today" options={{ title: t('ev.today') }} />
        <Stack.Screen name="events/[id]" options={{ title: t('ev.title') }} />
        <Stack.Screen name="checklist/[stepId]" options={{ title: t('ck.checklists') }} />
        <Stack.Screen name="approvals/index" options={{ title: t('ck.title') }} />
        <Stack.Screen name="approvals/damage/[id]" options={{ title: t('ck.damageReports') }} />
        <Stack.Screen name="counts/index" options={{ title: t('cnt.title') }} />
        <Stack.Screen name="notifications" options={{ title: t('ntf.title') }} />
        <Stack.Screen name="reports/index" options={{ title: t('rpt.title') }} />
        <Stack.Screen name="reports/[reportId]" options={{ title: t('rpt.title') }} />
        <Stack.Screen name="settings/notifications" options={{ title: t('ntf.settings') }} />
        <Stack.Screen name="counts/[sessionId]" options={{ title: t('cnt.sheet') }} />
      </Stack>
    </BiometricGate>
  );
}
