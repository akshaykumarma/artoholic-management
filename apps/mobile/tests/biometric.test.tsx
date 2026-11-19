import React from 'react';
import { AppState, Text } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BiometricGate, BIOMETRIC_KEY, LAST_ACTIVE_KEY } from '../src/auth/BiometricGate';

const listeners: Array<(s: string) => void> = [];
beforeEach(async () => {
  listeners.length = 0;
  await AsyncStorage.clear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
    listeners.push(fn as (s: string) => void);
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
  (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
  (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
});

const app = (onFallback = jest.fn()) =>
  render(
    <BiometricGate onPasswordFallback={onFallback}>
      <Text>secret data</Text>
    </BiometricGate>
  );

describe('biometric unlock (002 US5)', () => {
  it('asks for biometrics before showing data when reopened after > 5 minutes', async () => {
    await AsyncStorage.setItem(BIOMETRIC_KEY, 'on');
    await AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now() - 6 * 60_000));
    app();
    expect(await screen.findByText('Unlock Artoholic')).toBeTruthy();
    expect(screen.queryByText('secret data')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Unlock Artoholic' }));
    expect(await screen.findByText('secret data')).toBeTruthy();
  });

  it('does not ask when the app was in the background for less than 5 minutes', async () => {
    await AsyncStorage.setItem(BIOMETRIC_KEY, 'on');
    await AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now() - 60_000));
    app();
    expect(await screen.findByText('secret data')).toBeTruthy();
  });

  it('locks again when returning from a long background', async () => {
    await AsyncStorage.setItem(BIOMETRIC_KEY, 'on');
    await AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    app();
    expect(await screen.findByText('secret data')).toBeTruthy();
    const realNow = Date.now;
    await act(async () => listeners.forEach((l) => l('background')));
    Date.now = () => realNow() + 6 * 60_000;
    try {
      await act(async () => listeners.forEach((l) => l('active')));
      expect(await screen.findByText('Unlock Artoholic')).toBeTruthy();
    } finally {
      Date.now = realNow;
    }
  });

  it('after 3 failed or cancelled attempts, falls back to the password', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false, error: 'user_cancel' });
    await AsyncStorage.setItem(BIOMETRIC_KEY, 'on');
    await AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now() - 6 * 60_000));
    const onFallback = jest.fn();
    app(onFallback);
    const button = await screen.findByRole('button', { name: 'Unlock Artoholic' });
    for (let i = 0; i < 3; i++) {
      await act(async () => fireEvent.press(button));
    }
    await waitFor(() => expect(onFallback).toHaveBeenCalled());
  });

  it('is off unless turned on', async () => {
    await AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now() - 60 * 60_000));
    app();
    expect(await screen.findByText('secret data')).toBeTruthy();
  });
});
