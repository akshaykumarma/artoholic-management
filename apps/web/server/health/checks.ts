import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { Overall, PartStatus } from '@artoholic/shared';
import { getPool } from '../../db/client';

const TIMEOUT_MS = 2_000;
const HEARTBEAT_MAX_AGE_MS = 90_000;
const MEMO_MS = 10_000;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))]);
}

async function check(fn: () => Promise<boolean>): Promise<'ok' | 'down'> {
  try {
    return (await withTimeout(fn())) ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

const database = () => check(async () => (await getPool().query('SELECT 1')).rowCount === 1);

const fileStorage = () =>
  check(async () => {
    const s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? 'ap-south-1',
      forcePathStyle: true,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY ?? '', secretAccessKey: process.env.S3_SECRET_KEY ?? '' },
      maxAttempts: 1
    });
    try {
      await s3.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET ?? 'artoholic' }));
      return true;
    } finally {
      s3.destroy();
    }
  });

const backgroundWork = () =>
  check(async () => {
    const { rows } = await getPool().query<{ age_ms: number }>(
      "SELECT EXTRACT(EPOCH FROM (now() - last_beat_at)) * 1000 AS age_ms FROM system_heartbeats WHERE name = 'jobs'"
    );
    return rows.length > 0 && Number(rows[0]!.age_ms) < HEARTBEAT_MAX_AGE_MS;
  });

let memo: { at: number; parts: PartStatus[] } | undefined;

/** Live checks with a 10 s memo, so a failure shows within a minute (research R8, SC-006). */
export async function runChecks(): Promise<PartStatus[]> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.parts;
  const [db, fs, bg] = await Promise.all([database(), fileStorage(), backgroundWork()]);
  const at = new Date().toISOString();
  const parts: PartStatus[] = [
    { part: 'database', status: db, checkedAt: at },
    { part: 'fileStorage', status: fs, checkedAt: at },
    { part: 'backgroundWork', status: bg, checkedAt: at }
  ];
  memo = { at: Date.now(), parts };
  return parts;
}

export function resetHealthMemo(): void {
  memo = undefined;
}

export function overallStatus(parts: PartStatus[]): Overall {
  if (parts.find((p) => p.part === 'database')?.status === 'down') return 'down';
  return parts.some((p) => p.status === 'down') ? 'degraded' : 'ok';
}
