import React from 'react';
import { router } from 'expo-router';
import { ReportListScreen } from '../../../src/screens/ReportScreens';

export default function ReportsRoute() {
  return <ReportListScreen onOpen={(id) => router.push(`/reports/${id}` as never)} />;
}
