import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { REPORT_IDS, type ReportId } from '@artoholic/shared';
import { ReportScreen } from '../../../src/screens/ReportScreens';

export default function ReportRoute() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const id = (REPORT_IDS as readonly string[]).includes(String(reportId)) ? (String(reportId) as ReportId) : 'R1';
  return <ReportScreen id={id} />;
}
