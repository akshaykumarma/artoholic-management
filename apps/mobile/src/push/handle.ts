import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { mobilePath } from '@artoholic/shared';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true })
});

/** Where a tapped notification should take the user (FR-003). */
export function pathFromResponse(r: Notifications.NotificationResponse | null): string | null {
  const data = r?.notification.request.content.data as { path?: string } | undefined;
  return data?.path ? mobilePath(data.path) : null;
}

/** Opens the linked record when a notification is tapped, including the one that launched the app. */
export function useNotificationTaps(open: (path: string) => void, onReceive?: () => void) {
  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      const p = pathFromResponse(r);
      if (p) open(p);
    });
    const tap = Notifications.addNotificationResponseReceivedListener((r) => {
      const p = pathFromResponse(r);
      if (p) open(p);
    });
    const recv = Notifications.addNotificationReceivedListener(() => onReceive?.());
    return () => {
      tap.remove();
      recv.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
