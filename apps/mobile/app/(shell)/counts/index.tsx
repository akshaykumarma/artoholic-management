import React from 'react';
import { router } from 'expo-router';
import { CountListScreen } from '../../../src/screens/CountScreens';

export default function CountsRoute() {
  return <CountListScreen onOpen={(id) => router.push(`/counts/${id}` as never)} />;
}
