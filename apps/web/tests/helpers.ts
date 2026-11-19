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

import { hashPassword } from '../server/auth/password';
import type { Role } from '@artoholic/shared';

export interface TestUser {
  id: string;
  username: string;
  password: string;
}

let counter = 0;

/** Inserts an active user with the given roles. */
export async function createUser(opts: { roles?: Role[]; username?: string; password?: string; status?: 'active' | 'deactivated' } = {}): Promise<TestUser> {
  counter += 1;
  const username = opts.username ?? `user${counter}`;
  const password = opts.password ?? 'correct-horse-battery';
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO users (full_name, username, password_hash, status) VALUES ($1, $2, $3, $4) RETURNING id`,
    [`User ${counter}`, username, await hashPassword(password), opts.status ?? 'active']
  );
  const id = rows[0]!.id;
  for (const role of opts.roles ?? []) {
    await getPool().query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [id, role]);
  }
  return { id, username, password };
}
