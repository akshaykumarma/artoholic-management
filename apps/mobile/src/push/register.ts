import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { t, type ApiClient } from '@artoholic/shared';
import { explain } from '../permissions';

/**
 * Asks for permission and registers this device's Expo push token for the signed-in session
 * (008 R2). Refusal or a missing EAS project id simply means no push; in-app still works.
 */
export async function registerForPush(api: ApiClient): Promise<string | null> {
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Artoholic', importance: Notifications.AndroidImportance.HIGH });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status === 'undetermined') {
    await explain(t('perm.notifications'));
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.post('/api/v1/me/push-registrations', { expoToken: token });
  return token;
}
