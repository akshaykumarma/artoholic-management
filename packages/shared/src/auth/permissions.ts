import type { Role } from '../types';

/**
 * Permissions are code constants (research R9). Later features add theirs here; the API
 * enforces them on every handler, independently of what any menu shows (FR-009).
 */
export const PERMISSIONS = ['admin.status.view', 'admin.mobile_versions.edit', 'reference.conventions.view'] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  admin: [],
  event_manager: [],
  store_manager: []
};

export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((r) => ROLE_PERMISSIONS[r].includes(permission));
}
