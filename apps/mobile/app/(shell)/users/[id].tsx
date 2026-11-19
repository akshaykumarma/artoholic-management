import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { UserDetailScreen } from '../../../src/screens/UsersScreens';

export default function UserRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UserDetailScreen key={id} id={id} onEdit={(u) => router.push(`/users/edit/${u.id}` as never)} />;
}
