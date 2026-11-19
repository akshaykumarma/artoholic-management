import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CountSheetScreen } from '../../../src/screens/CountScreens';

export default function CountSheetRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <CountSheetScreen id={String(sessionId)} />;
}
