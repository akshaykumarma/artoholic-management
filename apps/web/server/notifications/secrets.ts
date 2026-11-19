import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** Provider secrets are stored encrypted (AES-256-GCM) with SETTINGS_ENCRYPTION_KEY and never returned (FR-009). */
function key(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') throw new Error('SETTINGS_ENCRYPTION_KEY is not set');
    return createHash('sha256').update('artoholic-dev-settings-key').digest();
  }
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain: string): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}

export function decryptSecret(blob: Buffer): string {
  const d = createDecipheriv('aes-256-gcm', key(), blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]).toString('utf8');
}
