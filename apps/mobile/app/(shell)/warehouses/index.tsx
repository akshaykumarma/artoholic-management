import React from 'react';
import { router } from 'expo-router';
import { WarehouseListScreen } from '../../../src/screens/WarehouseScreens';

export default function WarehousesRoute() {
  return <WarehouseListScreen onMove={(id) => router.push(`/warehouses/move?warehouseId=${id}` as never)} onTransfers={() => router.push('/warehouses/transfers' as never)} />;
}
