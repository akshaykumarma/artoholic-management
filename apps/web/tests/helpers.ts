import { getPool } from '../db/client';

const KEEP = new Set(['schema_migrations']);

/** Empties every table and re-seeds reference rows, so each test starts clean. */
export async function resetData(): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  const tables = rows.map((r) => r.tablename).filter((t) => !KEEP.has(t));
  if (tables.length) {
    // Triggers block DELETE on append-only tables; TRUNCATE is the test-only reset path.
    await pool.query(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
  await pool.query(`INSERT INTO mobile_version_settings (platform, minimum_version, recommended_version, store_url) VALUES
    ('android', '0.0.0', '0.0.0', 'https://play.google.com/store/apps/details?id=in.artoholic.ops'),
    ('ios', '0.0.0', '0.0.0', 'https://apps.apple.com/')`);
}
