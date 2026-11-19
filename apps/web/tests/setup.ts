/** Per-file setup: point at the test database, rebuild the schema once, and truncate between tests. */
import { beforeAll, beforeEach, afterAll } from 'vitest';
import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../../../.env') });
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://artoholic:artoholic@localhost:5432/artoholic_test';
(process.env as Record<string, string>).NODE_ENV = 'test';

const { getPool, closePool } = await import('../db/client');
const { migrate } = await import('../db/migrate');
const { resetData } = await import('./helpers');

beforeAll(async () => {
  const pool = getPool();
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(pool);
});

beforeEach(async () => {
  await resetData();
});

afterAll(async () => {
  await closePool();
});
