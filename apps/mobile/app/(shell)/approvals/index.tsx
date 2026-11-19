import React from 'react';
import { router } from 'expo-router';
import { ApprovalsScreen } from '../../../src/screens/ApprovalScreens';

export default function ApprovalsRoute() {
  return <ApprovalsScreen onOpenStep={(eventId, stepId) => router.push(`/checklist/${stepId}?eventId=${eventId}` as never)} onOpenReport={(id) => router.push(`/approvals/damage/${id}` as never)} />;
}
