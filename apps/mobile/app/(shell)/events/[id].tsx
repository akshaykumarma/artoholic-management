import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EventScreen } from '../../../src/screens/EventScreens';

export default function EventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventScreen id={String(id)} />;
}
