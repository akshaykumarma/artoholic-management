import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { EventScreen } from '../../../src/screens/EventScreens';

export default function EventRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventScreen id={String(id)} onOpenStep={(stepId) => router.push(`/checklist/${stepId}?eventId=${String(id)}` as never)} />;
}
