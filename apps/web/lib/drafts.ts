'use client';
import type { DraftStore } from '@artoholic/shared';

/** localStorage-backed drafts for the web app. */
export const webDraftStore: DraftStore = {
  async get<T>(key: string) {
    const v = typeof window === 'undefined' ? null : window.localStorage.getItem(key);
    return v === null ? null : (JSON.parse(v) as T);
  },
  async set<T>(key: string, value: T) {
    window.localStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string) {
    window.localStorage.removeItem(key);
  }
};
