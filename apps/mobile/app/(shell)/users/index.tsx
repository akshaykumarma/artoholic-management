import React from 'react';
import { router } from 'expo-router';
import { UsersListScreen } from '../../../src/screens/UsersScreens';

export default function UsersRoute() {
  return <UsersListScreen onOpen={(id) => router.push(`/users/${id}` as never)} onNew={() => router.push('/users/new')} />;
}
