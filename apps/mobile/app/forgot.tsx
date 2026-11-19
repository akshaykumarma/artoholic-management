import React from 'react';
import { router } from 'expo-router';
import ForgotScreen from '../src/screens/ForgotScreen';

export default function ForgotRoute() {
  return <ForgotScreen onDone={() => setTimeout(() => router.replace('/sign-in'), 1500)} />;
}
