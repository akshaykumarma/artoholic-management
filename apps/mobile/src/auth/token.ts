import * as SecureStore from 'expo-secure-store';

/** The session token lives only in the Keychain / Keystore (constitution V). */
const KEY = 'artoholic.session';

export const tokenStore = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token: string) => SecureStore.setItemAsync(KEY, token),
  clear: () => SecureStore.deleteItemAsync(KEY)
};
