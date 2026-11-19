import React from 'react';
import { router } from 'expo-router';
import { ItemListScreen } from '../../../src/screens/InventoryScreens';

export default function InventoryRoute() {
  return <ItemListScreen onOpen={(id) => router.push(`/inventory/${id}` as never)} />;
}
