import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { DamageReportScreen } from '../../../../src/screens/ApprovalScreens';

export default function DamageRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DamageReportScreen id={String(id)} />;
}
