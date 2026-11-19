import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DraftStore } from '@artoholic/shared';

/** AsyncStorage-backed drafts: unsaved work survives restarts and session expiry (FR-005a). */
export const mobileDraftStore: DraftStore = {
  async get<T>(key: string) {
    const v = await AsyncStorage.getItem(key);
    return v === null ? null : (JSON.parse(v) as T);
  },
  async set<T>(key: string, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string) {
    await AsyncStorage.removeItem(key);
  }
};
