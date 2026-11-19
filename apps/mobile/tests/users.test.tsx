import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../src/auth/AuthContext';
import { UserFormScreen } from '../src/screens/UsersScreens';
import ForgotScreen from '../src/screens/ForgotScreen';
import { installFetch, onRequest, resetFetch, calls, ME } from './fetch-mock';

beforeEach(async () => {
  resetFetch();
  installFetch();
  await SecureStore.setItemAsync('artoholic.session', 'tok-123');
  onRequest('/api/v1/me', { status: 200, body: { ...ME, mustChangePassword: false } });
});

const wrap = (ui: React.ReactElement) => render(<AuthProvider>{ui}</AuthProvider>);

describe('mobile user admin (002 US1)', () => {
  it('creates a user and offers Admin only to the Super Admin', async () => {
    const saved = { id: '0b1c2d3e-4f50-4617-8899-aabbccddeeff', fullName: 'Ravi', phone: '+919876543210', email: null, username: '+919876543210', roles: ['event_manager'], warehouseIds: [], status: 'active', mustChangePassword: true, createdAt: '2026-11-19T10:00:00.000Z', updatedAt: '2026-11-19T10:00:00.000Z' };
    onRequest('/api/v1/users', { status: 201, body: saved });
    const onSaved = jest.fn();
    wrap(<UserFormScreen onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText('☐  Admin')).toBeTruthy()); // ME is Super Admin
    fireEvent.changeText(screen.getByLabelText('Full name'), 'Ravi');
    fireEvent.changeText(screen.getByLabelText('Phone number'), '98765 43210');
    fireEvent.changeText(screen.getByLabelText('Temporary password'), 'marigold-tent-42');
    fireEvent.press(screen.getByText('☐  Event Manager'));
    fireEvent.press(screen.getByRole('button', { name: 'Create user' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Ravi' })));
    const post = calls.find((c) => c.url.endsWith('/api/v1/users'))!;
    expect(JSON.parse(String(post.init!.body))).toMatchObject({ fullName: 'Ravi', phone: '98765 43210', roles: ['event_manager'] });
  });

  it('shows password-policy rules from the server in words', async () => {
    onRequest('/api/v1/users', { status: 400, body: { error: { code: 'PASSWORD_POLICY', message: 'Choose a stronger password.', details: { rules: ['length', 'notCommon'] } } } });
    wrap(<UserFormScreen onSaved={jest.fn()} />);
    fireEvent.press(await screen.findByRole('button', { name: 'Create user' }));
    expect(await screen.findByText('At least 8 characters · Not a commonly used password')).toBeTruthy();
  });
});

describe('mobile forgot password (002 US3)', () => {
  it('requests a code, then resets with it', async () => {
    onRequest('/api/v1/auth/forgot', { status: 202, body: { message: "If an account matches, we've sent a code" } });
    onRequest('/api/v1/auth/reset', { status: 204 });
    const onDone = jest.fn();
    wrap(<ForgotScreen onDone={onDone} />);
    fireEvent.changeText(screen.getByLabelText('Username, email or phone'), '+919876543210');
    fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText("If an account matches, we've sent a code")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('6-digit code'), '123456');
    fireEvent.changeText(screen.getByLabelText('New password'), 'saffron-stage-77');
    fireEvent.press(screen.getByRole('button', { name: 'Set new password' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
