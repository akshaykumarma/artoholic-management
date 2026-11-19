import React, { useEffect } from 'react';
import { router } from 'expo-router';
import SignInScreen from '../src/screens/SignInScreen';
import { useAuth } from '../src/auth/AuthContext';

export default function SignInRoute() {
  const auth = useAuth();
  useEffect(() => {
    if (auth.status === 'signedIn') {
      // Back to where the user was when their session ended (FR-005a).
      auth.takeReturnPath().then((p) => router.replace(p as never));
    }
  }, [auth.status]); // eslint-disable-line react-hooks/exhaustive-deps
  return <SignInScreen onForgot={() => router.push('/forgot')} />;
}
