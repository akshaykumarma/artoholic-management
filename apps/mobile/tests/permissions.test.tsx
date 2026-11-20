import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { createApiClient } from '@artoholic/shared';
import { AuthProvider } from '../src/auth/AuthContext';
import { pickPhoto } from '../src/permissions';
import { registerForPush } from '../src/push/register';
import { DeleteAccountScreen } from '../src/screens/DeleteAccountScreen';
import { installFetch, onRequest, resetFetch, calls, ME } from './fetch-mock';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'project-1' } } } } }));

let alertSpy: jest.SpyInstance;
beforeEach(async () => {
  resetFetch();
  installFetch();
  jest.clearAllMocks();
  // Tapping OK on the explanation.
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[0]?.onPress?.());
  await SecureStore.setItemAsync('artoholic.session', 'tok-123');
});

describe('just-in-time permissions (011 FR-008)', () => {
  it('explains the camera before asking, and falls back to the gallery when refused', async () => {
    (ImagePicker.getCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false, status: 'undetermined', canAskAgain: true });
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false, status: 'denied' });
    const asset = await pickPhoto();
    expect(alertSpy.mock.calls[0][1]).toMatch(/camera is used only/);
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    expect(asset?.uri).toBe('file://photo.jpg');
  });

  it('does not ask again once the camera is granted', async () => {
    await pickPhoto();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
  });

  it('explains notifications before the system prompt', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
    onRequest('/api/v1/me/push-registrations', { status: 201, body: { registered: true } });
    const api = createApiClient({ baseUrl: 'http://test', platform: 'android', version: '0.1.0', getToken: async () => 'tok' });
    expect(await registerForPush(api)).toBe('ExponentPushToken[test-device]');
    expect(alertSpy.mock.calls[0][1]).toMatch(/Notifications tell you/);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });
});

describe('account deletion request (011 FR-007)', () => {
  it('explains what happens and sends the request', async () => {
    onRequest('/api/v1/me', { status: 200, body: { ...ME, roles: ['event_manager'] } });
    onRequest('/api/v1/me/deletion-request', { status: 201, body: { id: 'r1', dueAt: '2026-12-20T00:00:00.000Z', alreadyRequested: false } });
    render(<AuthProvider><DeleteAccountScreen /></AuthProvider>);
    expect(screen.getByText(/replaced with a pseudonym/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Yes, request deletion' }));
    expect(await screen.findByText('Request sent. It will be completed by 20-12-2026.')).toBeTruthy();
    expect(calls.some((c) => c.url.endsWith('/api/v1/me/deletion-request'))).toBe(true);
  });
});
