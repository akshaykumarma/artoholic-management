/**
 * Creates the one installation Super Admin (FR-004). Refuses if one already exists.
 * Usage: SUPER_ADMIN_USERNAME=owner SUPER_ADMIN_PASSWORD='…' SUPER_ADMIN_NAME='Owner' npm run seed:super-admin
 */
import path from 'node:path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../../../.env') });

async function main() {
  const { getPool, withTransaction, closePool } = await import('../db/client');
  const { hashPassword } = await import('../server/auth/password');
  const { writeAudit } = await import('../server/audit/write');
  const username = process.env.SUPER_ADMIN_USERNAME;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const fullName = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';
  if (!username || !password || password.length < 8) {
    throw new Error('Set SUPER_ADMIN_USERNAME and SUPER_ADMIN_PASSWORD (at least 8 characters).');
  }
  try {
    const existing = await getPool().query("SELECT 1 FROM user_roles WHERE role = 'super_admin'");
    if (existing.rowCount) throw new Error('A Super Admin already exists; nothing was changed.');
    await withTransaction(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        'INSERT INTO users (full_name, username, password_hash) VALUES ($1, $2, $3) RETURNING id',
        [fullName, username, await hashPassword(password)]
      );
      await tx.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'super_admin')", [rows[0]!.id]);
      await writeAudit(tx, { action: 'user.super_admin_seeded', entityType: 'user', entityId: rows[0]!.id, after: { username, fullName } });
    });
    console.log(`Super Admin "${username}" created.`);
  } finally {
    await closePool();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
