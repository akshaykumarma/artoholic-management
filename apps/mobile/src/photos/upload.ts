import * as ImageManipulator from 'expo-image-manipulator';
import type { ApiClient } from '@artoholic/shared';

export const MAX_SIDE = 1600;

/** Shrinks so the longest side is ≤ 1600 px, JPEG quality 0.8 (constitution IV, research R7). */
export async function compress(uri: string, width: number, height: number): Promise<string> {
  const longest = Math.max(width, height);
  const resize = longest > MAX_SIDE ? [{ resize: width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE } }] : [];
  const out = await ImageManipulator.manipulateAsync(uri, resize, { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
  return out.uri;
}

/** Compresses, uploads straight to storage with a presigned URL, then records the photo on the item. */
export async function uploadItemPhoto(api: ApiClient, itemId: string, asset: { uri: string; width: number; height: number }): Promise<void> {
  const uri = await compress(asset.uri, asset.width, asset.height);
  const { url, key } = await api.post<{ url: string; key: string }>(`/api/v1/catalogue/items/${itemId}/photos/upload-url`, { contentType: 'image/jpeg' });
  const blob = await (await fetch(uri)).blob();
  const put = await fetch(url, { method: 'PUT', body: blob, headers: { 'content-type': 'image/jpeg' } });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  await api.post(`/api/v1/catalogue/items/${itemId}/photos`, { key });
}
