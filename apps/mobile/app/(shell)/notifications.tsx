import React from 'react';
import { router } from 'expo-router';
import { NotificationsScreen } from '../../src/screens/NotificationScreens';

export default function NotificationsRoute() {
  return <NotificationsScreen onOpen={(p) => router.push(p as never)} onSettings={() => router.push('/settings/notifications' as never)} />;
}
