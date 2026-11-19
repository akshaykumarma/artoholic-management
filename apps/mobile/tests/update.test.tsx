import React from 'react';
import { AppState, Text } from 'react-native';
import { render, screen, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVersionCheck } from '../src/version/useVersionCheck';
import { installFetch, onRequest, resetFetch } from './fetch-mock';

jest.mock('../src/config', () => ({ API_URL: 'http://api.test', APP_VERSION: '1.2.0', PLATFORM: 'android' }));

function Probe() {
  const v = useVersionCheck();
  return <Text testID="state">{v.state}</Text>;
}

const settings = (minimumVersion: string, recommendedVersion: string) => ({
  status: 200,
  body: { platform: 'android', minimumVersion, recommendedVersion, storeUrl: 'https://play.google.com/store/apps/details?id=in.artoholic.ops' }
});

beforeEach(async () => {
  resetFetch();
  installFetch();
  await AsyncStorage.clear();
});

describe('version check (US3)', () => {
  it('blocks when the installed version is below the minimum', async () => {
    onRequest('/api/v1/app-version', settings('1.5.0', '1.5.0'));
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('required'));
  });

  it('prompts once a day when only a newer version is recommended', async () => {
    onRequest('/api/v1/app-version', settings('1.0.0', '1.3.0'));
    const first = render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('recommended'));
    first.unmount();
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('ok'));
  });

  it('does not block when the server cannot be reached', async () => {
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('ok'));
  });

  it('re-checks when the app returns to the foreground', async () => {
    let min = '1.0.0';
    onRequest('/api/v1/app-version', () => settings(min, min));
    const listeners: Array<(s: string) => void> = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
      listeners.push(fn as (s: string) => void);
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('ok'));
    min = '2.0.0';
    await act(async () => listeners.forEach((l) => l('active')));
    await waitFor(() => expect(screen.getByTestId('state').props.children).toBe('required'));
  });
});
