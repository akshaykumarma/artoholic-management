import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { MoveScreen } from '../../../src/screens/WarehouseScreens';

export default function MoveRoute() {
  const { warehouseId } = useLocalSearchParams<{ warehouseId: string }>();
  return <MoveScreen warehouseId={String(warehouseId)} />;
}
