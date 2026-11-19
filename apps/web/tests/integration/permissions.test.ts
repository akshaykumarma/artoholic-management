import { describe, it, expect } from 'vitest';
import { hasPermission, ROLE_PERMISSIONS, PERMISSIONS, type Role } from '@artoholic/shared';
import { requirePermission } from '../../server/auth/guards';
import { ApiError } from '../../server/http/errors';

const auth = (roles: Role[]) => ({
  user: { id: 'u', fullName: 'U', username: 'u', roles },
  session: { id: 's', platform: 'web' as const, expiresAt: new Date(), idleTimeoutMinutes: 60 }
});

describe('requirePermission', () => {
  it('allows Super Admin the status permissions', () => {
    expect(() => requirePermission(auth(['super_admin']), 'admin.status.view')).not.toThrow();
  });

  it('refuses roles without the permission, regardless of menu', () => {
    for (const roles of [[], ['admin'], ['event_manager'], ['store_manager'], ['event_manager', 'store_manager']] as const) {
      try {
        requirePermission(auth([...roles]), 'admin.status.view');
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).code).toBe('FORBIDDEN');
      }
    }
  });

  it('is the union across roles', () => {
    for (const p of PERMISSIONS) {
      const either = hasPermission(['admin', 'super_admin'], p);
      expect(either).toBe(ROLE_PERMISSIONS.admin.includes(p) || ROLE_PERMISSIONS.super_admin.includes(p));
    }
  });
});
