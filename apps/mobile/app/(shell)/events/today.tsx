import React from 'react';
import { router } from 'expo-router';
import { TodayScreen } from '../../../src/screens/EventScreens';

export default function TodayRoute() {
  return <TodayScreen onOpen={(id) => router.push(`/events/${id}` as never)} />;
}
