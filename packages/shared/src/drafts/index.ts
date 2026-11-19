/**
 * Unsaved work survives a session ending (FR-005a, research R10). Web uses localStorage,
 * mobile AsyncStorage; both implement this interface.
 */
export interface DraftStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export const RETURN_PATH_KEY = 'artoholic:return-path';

export function draftKey(userId: string, formKey: string): string {
  return `artoholic:draft:${userId}:${formKey}`;
}

/** In-memory store for tests and server-side rendering. */
export function memoryDraftStore(): DraftStore {
  const m = new Map<string, string>();
  return {
    async get<T>(k: string) {
      const v = m.get(k);
      return v === undefined ? null : (JSON.parse(v) as T);
    },
    async set<T>(k: string, v: T) {
      m.set(k, JSON.stringify(v));
    },
    async remove(k: string) {
      m.delete(k);
    }
  };
}
