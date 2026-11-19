import { describe, it, expect } from 'vitest';
import { getPool } from '../../db/client';

describe('schema', () => {
  it('rejects UPDATE and DELETE on audit_entries', async () => {
    const pool = getPool();
    await pool.query("INSERT INTO audit_entries (action) VALUES ('test.action')");
    await expect(pool.query("UPDATE audit_entries SET action = 'x'")).rejects.toThrow(/append-only/);
    await expect(pool.query('DELETE FROM audit_entries')).rejects.toThrow(/append-only/);
  });

  it('allows only one Super Admin', async () => {
    const pool = getPool();
    const a = await pool.query("INSERT INTO users (full_name, username, password_hash) VALUES ('A','aaa','x') RETURNING id");
    const b = await pool.query("INSERT INTO users (full_name, username, password_hash) VALUES ('B','bbb','x') RETURNING id");
    await pool.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'super_admin')", [a.rows[0].id]);
    await expect(
      pool.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'super_admin')", [b.rows[0].id])
    ).rejects.toThrow(/user_roles_one_super_admin/);
  });
});
