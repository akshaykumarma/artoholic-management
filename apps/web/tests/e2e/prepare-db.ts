import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { migrate } from '../../db/migrate';

/** Fresh e2e database with one Super Admin (owner / e2e-password-123). */
export default async function prepareDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_E2E ?? 'postgres://artoholic:artoholic@localhost:5432/artoholic_e2e' });
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await migrate(pool);
    const { rows } = await pool.query<{ id: string }>(
      "INSERT INTO users (full_name, username, password_hash) VALUES ('Owner', 'owner', $1) RETURNING id",
      [await bcrypt.hash('e2e-password-123', 12)]
    );
    await pool.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'super_admin')", [rows[0]!.id]);
    await pool.query("INSERT INTO system_heartbeats (name, last_beat_at) VALUES ('jobs', now()) ON CONFLICT (name) DO UPDATE SET last_beat_at = now()");
    const em = await pool.query<{ id: string }>(
      "INSERT INTO users (full_name, username, password_hash) VALUES ('Priya', 'priya', $1) RETURNING id",
      [await bcrypt.hash('e2e-password-123', 12)]
    );
    await pool.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'event_manager'), ($1, 'store_manager')", [em.rows[0]!.id]);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  prepareDb().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
