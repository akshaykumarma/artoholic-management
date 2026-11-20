import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { t } from '@artoholic/shared';

/** Shows why a permission is needed, then continues when the user taps OK (011 FR-008). */
export function explain(message: string, title = 'Artoholic'): Promise<void> {
  return new Promise((resolve) => Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }], { cancelable: false }));
}

/**
 * Takes a photo, asking for the camera only now and saying why first. If the camera is refused,
 * the photo library is offered instead, so damage can still be recorded.
 */
export async function pickPhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  let perm = await ImagePicker.getCameraPermissionsAsync();
  if (!perm.granted && perm.canAskAgain !== false && perm.status !== 'denied') {
    await explain(t('perm.camera'));
    perm = await ImagePicker.requestCameraPermissionsAsync();
  }
  const shot = perm.granted ? await ImagePicker.launchCameraAsync({ quality: 1 }) : await ImagePicker.launchImageLibraryAsync({ quality: 1 });
  return !shot.canceled ? shot.assets[0] ?? null : null;
}
