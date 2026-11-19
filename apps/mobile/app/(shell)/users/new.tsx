import React from 'react';
import { router } from 'expo-router';
import { UserFormScreen } from '../../../src/screens/UsersScreens';

export default function NewUserRoute() {
  return <UserFormScreen onSaved={(u) => router.replace(`/users/${u.id}` as never)} />;
}
