import React from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth/AuthContext';
import { useVersionCheck } from '../src/version/useVersionCheck';
import { UpdatePrompt, UpdateRequired } from '../src/version/UpdateRequired';

/** Version gate first (US3): a blocked app shows only the update screen. */
function VersionGate({ children }: { children: React.ReactNode }) {
  const v = useVersionCheck();
  if (v.state === 'required') return <UpdateRequired storeUrl={v.storeUrl} />;
  return (
    <>
      {v.state === 'recommended' ? <UpdatePrompt storeUrl={v.storeUrl} onDismiss={v.dismiss} /> : null}
      {children}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <VersionGate>
          <AuthProvider>
            <Slot />
          </AuthProvider>
        </VersionGate>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
