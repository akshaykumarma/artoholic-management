import type { ClientPlatform, Role } from '../types';
import { ROLES } from '../types';
import type { MessageKey } from '../i18n';

export interface ModuleDef {
  id: string;
  labelKey: MessageKey;
  path: string;
  roles: readonly Role[];
  apps: readonly ClientPlatform[];
  shipped: boolean;
  deliveredIn: string;
}

const ALL_APPS = ['web', 'android', 'ios'] as const;

/** The module map from specs/001-overview/spec.md. A module appears in menus only once shipped. */
export const MODULES: readonly ModuleDef[] = [
  { id: 'home', labelKey: 'module.home', path: '/', roles: ROLES, apps: ALL_APPS, shipped: true, deliveredIn: '001' },
  { id: 'users', labelKey: 'module.users', path: '/users', roles: ['super_admin', 'admin'], apps: ALL_APPS, shipped: true, deliveredIn: '002' },
  { id: 'inventory', labelKey: 'module.inventory', path: '/inventory', roles: ROLES, apps: ALL_APPS, shipped: true, deliveredIn: '003' },
  { id: 'warehouses', labelKey: 'module.warehouses', path: '/warehouses', roles: ['super_admin', 'admin', 'store_manager'], apps: ALL_APPS, shipped: false, deliveredIn: '004' },
  { id: 'events', labelKey: 'module.events', path: '/events', roles: ROLES, apps: ALL_APPS, shipped: false, deliveredIn: '005' },
  { id: 'checklists', labelKey: 'module.checklists', path: '/approvals', roles: ROLES, apps: ALL_APPS, shipped: false, deliveredIn: '006' },
  { id: 'counts', labelKey: 'module.counts', path: '/counts', roles: ['super_admin', 'admin', 'store_manager'], apps: ALL_APPS, shipped: false, deliveredIn: '007' },
  { id: 'notifications', labelKey: 'module.notifications', path: '/notifications', roles: ROLES, apps: ALL_APPS, shipped: false, deliveredIn: '008' },
  { id: 'reports', labelKey: 'module.reports', path: '/reports', roles: ROLES, apps: ALL_APPS, shipped: false, deliveredIn: '009' },
  { id: 'admin-console', labelKey: 'module.adminConsole', path: '/admin', roles: ['super_admin', 'admin'], apps: ['web'], shipped: false, deliveredIn: '010' },
  { id: 'admin-status', labelKey: 'module.adminStatus', path: '/admin/status', roles: ['super_admin'], apps: ['web'], shipped: true, deliveredIn: '001' },
  { id: 'conventions', labelKey: 'module.conventions', path: '/reference/conventions', roles: ['super_admin'], apps: ALL_APPS, shipped: true, deliveredIn: '001' }
];

export interface MenuItem {
  moduleId: string;
  labelKey: MessageKey;
  path: string;
}

/** Menu = shipped modules any of the roles may see, on this app, once each, in module-map order. */
export function buildMenu(roles: readonly Role[], platform: ClientPlatform): MenuItem[] {
  return MODULES.filter((m) => m.shipped && m.apps.includes(platform) && m.roles.some((r) => roles.includes(r))).map(
    (m) => ({ moduleId: m.id, labelKey: m.labelKey, path: m.path })
  );
}
