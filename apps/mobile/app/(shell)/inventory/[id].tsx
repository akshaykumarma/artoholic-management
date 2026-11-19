import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ItemViewScreen } from '../../../src/screens/InventoryScreens';

export default function ItemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ItemViewScreen key={id} id={id} />;
}
