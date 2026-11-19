import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TransferScreen } from '../../../../src/screens/WarehouseScreens';

export default function TransferRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TransferScreen id={String(id)} />;
}
