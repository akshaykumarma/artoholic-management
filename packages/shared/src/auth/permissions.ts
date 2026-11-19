import type { Role } from '../types';

/**
 * The permission matrix from specs/002-auth-rbac/spec.md, as code constants (research R7).
 * "A" (assigned-only) cells grant the permission here; the record scope is then enforced by
 * requireWarehouseScope / requireEventAssignment on the server.
 */
export const PERMISSIONS = [
  'admins.manage',
  'users.manage',
  'settings.manage',
  'settings.view',
  'catalogue.manage',
  'catalogue.view',
  'stock.view',
  'stock.move',
  'stock.approve',
  'warehouses.manage',
  'locations.manage',
  'events.manage',
  'events.view',
  'events.edit_closed',
  'checklist.warehouse',
  'checklist.site',
  'damage.report',
  'damage.approve',
  'counts.schedule',
  'counts.perform',
  'reports.run',
  'reports.schedule',
  'audit.view',
  'admin.status.view',
  'admin.mobile_versions.edit',
  'reference.conventions.view'
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ADMIN: readonly Permission[] = [
  'users.manage', 'settings.view', 'catalogue.manage', 'catalogue.view', 'stock.view', 'stock.move', 'stock.approve',
  'warehouses.manage', 'locations.manage', 'events.manage', 'events.view', 'events.edit_closed', 'checklist.warehouse',
  'checklist.site', 'damage.report', 'damage.approve', 'counts.schedule', 'counts.perform', 'reports.run',
  'reports.schedule', 'audit.view'
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  admin: ADMIN,
  event_manager: ['catalogue.view', 'stock.view', 'events.view', 'checklist.site', 'damage.report', 'reports.run'],
  store_manager: [
    'catalogue.view', 'stock.view', 'stock.move', 'locations.manage', 'events.view', 'checklist.warehouse',
    'damage.report', 'counts.perform', 'reports.run'
  ]
};

export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((r) => ROLE_PERMISSIONS[r].includes(permission));
}
