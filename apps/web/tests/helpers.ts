import { getPool } from '../db/client';
import { clearVersionCache } from '../server/versions/settings';

const KEEP = new Set(['schema_migrations']);

/** Empties every table and re-seeds reference rows, so each test starts clean. */
export async function resetData(): Promise<void> {
  clearVersionCache();
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
  await pool.query(`INSERT INTO units (code, name, family, factor_to_base) VALUES
    ('m', 'metre', 'length', 1), ('cm', 'centimetre', 'length', 0.01), ('mm', 'millimetre', 'length', 0.001), ('ft', 'foot', 'length', 0.3048),
    ('kg', 'kilogram', 'mass', 1), ('g', 'gram', 'mass', 0.001), ('l', 'litre', 'volume', 1), ('ml', 'millilitre', 'volume', 0.001)`);
  await pool.query(`INSERT INTO event_types (name, position) VALUES ('Wedding', 1), ('Corporate event', 2), ('Political rally or Public meeting', 3), ('Other', 4)`);
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

/** Inserts a bare warehouse (with its default location) and returns its id. */
export async function makeWarehouseId(code?: string): Promise<string> {
  counter += 1;
  const c = code ?? `W${counter}${Math.floor(Math.random() * 1000)}`.slice(0, 8).toUpperCase();
  const { rows } = await getPool().query<{ id: string }>('INSERT INTO warehouses (code, name) VALUES ($1, $1) RETURNING id', [c]);
  await getPool().query('INSERT INTO locations (warehouse_id, code, is_default, level) VALUES ($1, $2, true, 0)', [rows[0]!.id, `${c}-DEFAULT`]);
  return rows[0]!.id;
}
