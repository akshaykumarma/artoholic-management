import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Role } from '@artoholic/shared';
import { requireWarehouseScope } from '../../server/auth/guards';
import { createUser } from '../helpers';
import { getPool } from '../../db/client';

const auth = (id: string, roles: Role[]) => ({
  user: { id, fullName: 'x', username: 'x', roles, mustChangePassword: false },
  session: { id: 's', platform: 'web' as const, expiresAt: new Date(), idleTimeoutMinutes: 60 }
});

describe('requireWarehouseScope', () => {
  it('Admins and the Super Admin act on every warehouse', async () => {
    for (const role of ['admin', 'super_admin'] as const) {
      const u = await createUser({ roles: [role] });
      await expect(requireWarehouseScope(auth(u.id, [role]), randomUUID())).resolves.toBeUndefined();
    }
  });

  it('Store Managers act only on assigned warehouses', async () => {
    const u = await createUser({ roles: ['store_manager'] });
    const mine = randomUUID();
    await getPool().query('INSERT INTO warehouse_assignments (user_id, warehouse_id) VALUES ($1, $2)', [u.id, mine]);
    await expect(requireWarehouseScope(auth(u.id, ['store_manager']), mine)).resolves.toBeUndefined();
    await expect(requireWarehouseScope(auth(u.id, ['store_manager']), randomUUID())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('an ended assignment no longer grants access', async () => {
    const u = await createUser({ roles: ['store_manager'] });
    const wh = randomUUID();
    await getPool().query('INSERT INTO warehouse_assignments (user_id, warehouse_id, unassigned_at) VALUES ($1, $2, now())', [u.id, wh]);
    await expect(requireWarehouseScope(auth(u.id, ['store_manager']), wh)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('Event Managers have no warehouse scope', async () => {
    const u = await createUser({ roles: ['event_manager'] });
    await expect(requireWarehouseScope(auth(u.id, ['event_manager']), randomUUID())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
