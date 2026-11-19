import { describe, it, expect } from 'vitest';
import { hasPermission, type Permission, type Role } from '@artoholic/shared';

/**
 * One case per cell of the binding permission matrix in specs/002-auth-rbac/spec.md (SC-004).
 * F, A and V all mean the role holds the permission; – means it does not.
 */
const MATRIX: Array<[string, Permission, Record<Role, boolean>]> = [
  ['Create and edit Admins', 'admins.manage', { super_admin: true, admin: false, event_manager: false, store_manager: false }],
  ['Create and edit other users and roles', 'users.manage', { super_admin: true, admin: true, event_manager: false, store_manager: false }],
  ['Platform settings (edit)', 'settings.manage', { super_admin: true, admin: false, event_manager: false, store_manager: false }],
  ['Platform settings (view)', 'settings.view', { super_admin: true, admin: true, event_manager: false, store_manager: false }],
  ['Categories, items, units (manage)', 'catalogue.manage', { super_admin: true, admin: true, event_manager: false, store_manager: false }],
  ['Categories, items, units (view)', 'catalogue.view', { super_admin: true, admin: true, event_manager: true, store_manager: true }],
  ['Stock actions', 'stock.move', { super_admin: true, admin: true, event_manager: false, store_manager: true }],
  ['Warehouses setup', 'warehouses.manage', { super_admin: true, admin: true, event_manager: false, store_manager: false }],
  ['Location setup', 'locations.manage', { super_admin: true, admin: true, event_manager: false, store_manager: true }],
  ['View stock levels', 'stock.view', { super_admin: true, admin: true, event_manager: true, store_manager: true }],
  ['Create, edit and cancel events', 'events.manage', { super_admin: true, admin: true, event_manager: false, store_manager: false }],
  ['View events', 'events.view', { super_admin: true, admin: true, event_manager: true, store_manager: true }],
  ['Warehouse dispatch and receipt', 'checklist.warehouse', { super_admin: true, admin: true, event_manager: false, store_manager: true }],
  ['Site receipt and return dispatch', 'checklist.site', { super_admin: true, admin: true, event_manager: true, store_manager: false }],
  ['Report damage or loss', 'damage.report', { super_admin: true, admin: true, event_manager: true, store_manager: true }],
  ['Approve damage and loss', 'damage.approve', { super_admin: true, admin: true, event_manager: false, store_manager: false }],
  ['Approve stock adjustments', 'stock.approve', { super_admin: true, admin: true, event_manager: false, store_manager: false }],
  ['Physical-count schedules', 'counts.schedule', { super_admin: true, admin: true, event_manager: false, store_manager: false }],
  ['Perform a physical count', 'counts.perform', { super_admin: true, admin: true, event_manager: false, store_manager: true }],
  ['Edit a closed event', 'events.edit_closed', { super_admin: true, admin: true, event_manager: false, store_manager: false }],
  ['Run reports', 'reports.run', { super_admin: true, admin: true, event_manager: true, store_manager: true }],
  ['Report schedules and recipients', 'reports.schedule', { super_admin: true, admin: true, event_manager: false, store_manager: false }],
  ['Audit log', 'audit.view', { super_admin: true, admin: true, event_manager: false, store_manager: false }]
];

describe('permission matrix', () => {
  for (const [label, permission, expected] of MATRIX) {
    for (const role of Object.keys(expected) as Role[]) {
      it(`${label}: ${role} → ${expected[role] ? 'allowed' : 'refused'}`, () => {
        expect(hasPermission([role], permission)).toBe(expected[role]);
      });
    }
  }
});
