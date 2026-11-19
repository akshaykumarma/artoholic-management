import type { ApiClient, DraftStore } from '@artoholic/shared';
import { compress } from './upload';

/**
 * Damage photos go through a persistent queue (006 research R4): each photo is compressed on the
 * phone, kept on the device until its upload succeeds, and retried with backoff, so a failed
 * upload never loses the rest of the checklist. The stamp (IST time, event number) travels with it.
 */
export interface QueuedPhoto {
  localId: string;
  uri: string;
  stepId: string;
  entryId: string;
  eventNumber: string;
  takenAt: string;
  attempts: number;
  key?: string;
  nextTryAt?: number;
}

export const QUEUE_KEY = 'artoholic:photo-queue';

export async function readQueue(store: DraftStore): Promise<QueuedPhoto[]> {
  return (await store.get<QueuedPhoto[]>(QUEUE_KEY)) ?? [];
}

export async function enqueuePhoto(store: DraftStore, asset: { uri: string; width: number; height: number }, p: Pick<QueuedPhoto, 'stepId' | 'entryId' | 'eventNumber'>): Promise<QueuedPhoto> {
  const uri = await compress(asset.uri, asset.width, asset.height);
  const item: QueuedPhoto = { ...p, uri, localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, takenAt: new Date().toISOString(), attempts: 0 };
  await store.set(QUEUE_KEY, [...(await readQueue(store)), item]);
  return item;
}

/** Uploads what it can; returns the photos that now have a storage key. Failures stay queued with backoff. */
export async function processQueue(api: ApiClient, store: DraftStore, now = Date.now()): Promise<QueuedPhoto[]> {
  const queue = await readQueue(store);
  for (const p of queue) {
    if (p.key || (p.nextTryAt && p.nextTryAt > now)) continue;
    try {
      const { url, key } = await api.post<{ url: string; key: string }>('/api/v1/photos/upload-url', { purpose: 'damage', contentType: 'image/jpeg' });
      const blob = await (await fetch(p.uri)).blob();
      const put = await fetch(url, { method: 'PUT', body: blob, headers: { 'content-type': 'image/jpeg' } });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      p.key = key;
    } catch {
      p.attempts += 1;
      p.nextTryAt = now + Math.min(60_000, 1000 * 2 ** p.attempts);
    }
  }
  await store.set(QUEUE_KEY, queue);
  return queue.filter((p) => p.key);
}

/** Drops uploaded photos once their step has been submitted. */
export async function forgetStep(store: DraftStore, stepId: string): Promise<void> {
  await store.set(QUEUE_KEY, (await readQueue(store)).filter((p) => p.stepId !== stepId));
}
