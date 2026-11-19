import { describe, it, expect, afterEach } from 'vitest';
import { getPool } from '../../db/client';
import { runChecks, overallStatus, resetHealthMemo } from '../../server/health/checks';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  resetHealthMemo();
});

describe('health checks (FR-040, SC-006)', () => {
  it('file storage unreachable → that part down, overall degraded', async () => {
    process.env.S3_ENDPOINT = 'http://127.0.0.1:9'; // nothing listens here
    await getPool().query("INSERT INTO system_heartbeats (name, last_beat_at) VALUES ('jobs', now())");
    const parts = await runChecks();
    expect(parts.find((p) => p.part === 'database')!.status).toBe('ok');
    expect(parts.find((p) => p.part === 'fileStorage')!.status).toBe('down');
    expect(overallStatus(parts)).toBe('degraded');
  });

  it('stale or missing heartbeat → background work down', async () => {
    await getPool().query("INSERT INTO system_heartbeats (name, last_beat_at) VALUES ('jobs', now() - interval '5 minutes')");
    const parts = await runChecks();
    expect(parts.find((p) => p.part === 'backgroundWork')!.status).toBe('down');
  });

  it('database down → overall down', () => {
    expect(
      overallStatus([
        { part: 'database', status: 'down', checkedAt: '' },
        { part: 'fileStorage', status: 'ok', checkedAt: '' },
        { part: 'backgroundWork', status: 'ok', checkedAt: '' }
      ])
    ).toBe('down');
  });
});
