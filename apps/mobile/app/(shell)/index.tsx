import React from 'react';
import { router } from 'expo-router';
import HomeScreen from '../../src/screens/HomeScreen';

export default function HomeRoute() {
  return <HomeScreen onOpen={(path) => router.push(path as never)} />;
}
