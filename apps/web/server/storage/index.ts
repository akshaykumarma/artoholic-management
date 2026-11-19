import { HeadObjectCommand, PutObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** Object storage for photos and files. Tests use the in-memory implementation. */
export interface Storage {
  presignPut(key: string, contentType: string): Promise<string>;
  presignGet(key: string): Promise<string>;
  head(key: string): Promise<{ bytes: number; contentType: string } | null>;
}

function s3(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'ap-south-1',
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY ?? '', secretAccessKey: process.env.S3_SECRET_KEY ?? '' }
  });
}
const bucket = () => process.env.S3_BUCKET ?? 'artoholic';

const s3Storage: Storage = {
  presignPut: (key, contentType) => getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), { expiresIn: 300 }),
  presignGet: (key) => getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 900 }),
  async head(key) {
    try {
      const r = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
      return { bytes: r.ContentLength ?? 0, contentType: r.ContentType ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  }
};

/** In-memory storage: tests "upload" by calling memoryStorage.put. */
const objects = new Map<string, { bytes: number; contentType: string }>();
export const memoryStorage: Storage & { put(key: string, bytes: number, contentType: string): void; clear(): void } = {
  presignPut: async (key) => `memory://put/${key}`,
  presignGet: async (key) => `memory://get/${key}`,
  head: async (key) => objects.get(key) ?? null,
  put: (key, bytes, contentType) => void objects.set(key, { bytes, contentType }),
  clear: () => objects.clear()
};

export function getStorage(): Storage {
  return process.env.NODE_ENV === 'test' ? memoryStorage : s3Storage;
}
