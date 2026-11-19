import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { userSchema, type User } from '@artoholic/shared';
import { useAuth } from '../../../../src/auth/AuthContext';
import { UserFormScreen } from '../../../../src/screens/UsersScreens';

export default function EditUserRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    void api.get(`/api/v1/users/${id}`, userSchema).then(setUser);
  }, [api, id]);
  if (!user) return null;
  return <UserFormScreen user={user} onSaved={(u) => router.replace(`/users/${u.id}` as never)} />;
}
