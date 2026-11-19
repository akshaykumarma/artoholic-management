import React from 'react';
import { router } from 'expo-router';
import { TransferListScreen } from '../../../../src/screens/WarehouseScreens';

export default function TransfersRoute() {
  return <TransferListScreen onOpen={(id) => router.push(`/warehouses/transfers/${id}` as never)} />;
}
