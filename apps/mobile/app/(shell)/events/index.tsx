import React from 'react';
import { router } from 'expo-router';
import { EventListScreen } from '../../../src/screens/EventScreens';

export default function EventsRoute() {
  return <EventListScreen onOpen={(id) => router.push(`/events/${id}` as never)} onToday={() => router.push('/events/today' as never)} />;
}
