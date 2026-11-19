import { createApiClient } from '@artoholic/shared';
import * as Notifications from 'expo-notifications';
import { registerForPush } from '../src/push/register';
import { pathFromResponse } from '../src/push/handle';
import { installFetch, onRequest, resetFetch, calls } from './fetch-mock';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'project-1' } } } } }));

beforeEach(() => {
  resetFetch();
  installFetch();
});

describe('push (008 FR-003)', () => {
  it('registers the device token for the signed-in session', async () => {
    onRequest('/api/v1/me/push-registrations', { status: 201, body: { registered: true } });
    const api = createApiClient({ baseUrl: 'http://test', platform: 'android', version: '0.1.0', getToken: async () => 'tok' });
    expect(await registerForPush(api)).toBe('ExponentPushToken[test-device]');
    expect(JSON.parse(String(calls.find((c) => c.url.endsWith('/push-registrations'))!.init!.body))).toEqual({ expoToken: 'ExponentPushToken[test-device]' });
  });

  it('does not register when permission is refused', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const api = createApiClient({ baseUrl: 'http://test', platform: 'android', version: '0.1.0', getToken: async () => 'tok' });
    expect(await registerForPush(api)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('opens the record a tapped notification links to', () => {
    const tap = (path: string) => ({ notification: { request: { content: { data: { path } } } } }) as unknown as Notifications.NotificationResponse;
    expect(pathFromResponse(tap('/approvals/damage/d1'))).toBe('/approvals/damage/d1');
    expect(pathFromResponse(tap('/inventory/items/i1'))).toBe('/inventory/i1');
    expect(pathFromResponse(null)).toBeNull();
  });
});
