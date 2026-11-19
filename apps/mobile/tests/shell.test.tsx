import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RETURN_PATH_KEY } from '@artoholic/shared';
import SignInScreen from '../src/screens/SignInScreen';
import HomeScreen from '../src/screens/HomeScreen';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { installFetch, onRequest, resetFetch, calls, ME } from './fetch-mock';

beforeEach(() => {
  resetFetch();
  installFetch();
});

function renderWithAuth(ui: React.ReactElement) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

describe('mobile sign-in (US1)', () => {
  it('signs in, stores the token in secure storage and sends platform headers', async () => {
    onRequest('/api/v1/auth/sign-in', { status: 200, body: { user: ME, token: 'tok-123', expiresAt: ME.session.expiresAt } });
    renderWithAuth(<SignInScreen />);
    fireEvent.changeText(screen.getByLabelText('Username, email or phone'), 'owner');
    fireEvent.changeText(screen.getByLabelText('Password'), 'secret-pass-1');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalledWith('artoholic.session', 'tok-123'));
    const headers = calls[0]!.init!.headers as Record<string, string>;
    expect(['ios', 'android']).toContain(headers['x-client-platform']);
    expect(headers['x-client-version']).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('shows the generic error on wrong credentials', async () => {
    onRequest('/api/v1/auth/sign-in', {
      status: 401,
      body: { error: { code: 'INVALID_CREDENTIALS', message: 'Username or password is incorrect' } }
    });
    renderWithAuth(<SignInScreen />);
    fireEvent.changeText(screen.getByLabelText('Username, email or phone'), 'owner');
    fireEvent.changeText(screen.getByLabelText('Password'), 'wrong-pass-1');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Username or password is incorrect')).toBeTruthy();
  });
});

describe('mobile home menu (US1)', () => {
  it('renders the menu entries the server sent', async () => {
    await SecureStore.setItemAsync('artoholic.session', 'tok-123');
    onRequest('/api/v1/me', { status: 200, body: ME });
    renderWithAuth(<HomeScreen />);
    expect(await screen.findByText('Welcome, Owner')).toBeTruthy();
    expect(screen.getByText('Display conventions')).toBeTruthy();
    expect(screen.queryByText('Platform status')).toBeNull();
  });
});

describe('session expiry keeps the user’s place (FR-005a)', () => {
  function Probe({ path }: { path: string }) {
    const auth = useAuth();
    return <>{auth.status === 'signedOut' ? null : null}{auth.markLocation(path)}</>;
  }

  it('on SESSION_EXPIRED, clears the token, saves the return path and signs out', async () => {
    await SecureStore.setItemAsync('artoholic.session', 'tok-123');
    let first = true;
    onRequest('/api/v1/me', () => {
      if (first) {
        first = false;
        return { status: 200, body: ME };
      }
      return { status: 401, body: { error: { code: 'SESSION_EXPIRED', message: 'Your session has ended. Please sign in again.' } } };
    });
    let ctx: ReturnType<typeof useAuth> | undefined;
    function Capture() {
      ctx = useAuth();
      return null;
    }
    render(
      <AuthProvider>
        <Probe path="/reference/conventions" />
        <Capture />
      </AuthProvider>
    );
    await waitFor(() => expect(ctx!.status).toBe('signedIn'));
    await ctx!.refresh().catch(() => undefined);
    await waitFor(() => expect(ctx!.status).toBe('signedOut'));
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('artoholic.session');
    expect(JSON.parse((await AsyncStorage.getItem(RETURN_PATH_KEY))!)).toBe('/reference/conventions');
  });
});
