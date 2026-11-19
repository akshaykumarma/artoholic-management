import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ChecklistScreen } from '../../../src/checklist/ChecklistScreen';

export default function ChecklistRoute() {
  const { stepId, eventId } = useLocalSearchParams<{ stepId: string; eventId: string }>();
  return <ChecklistScreen eventId={String(eventId)} stepId={String(stepId)} />;
}
