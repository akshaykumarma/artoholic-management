import { describe, it, expect } from 'vitest';
import { buildMenu, MODULES } from '../src/modules';

describe('buildMenu', () => {
  it('shows only shipped modules the roles allow, on the requesting app', () => {
    const web = buildMenu(['super_admin'], 'web').map((m) => m.moduleId);
    expect(web).toEqual(['home', 'admin-status', 'conventions']);
    const android = buildMenu(['super_admin'], 'android').map((m) => m.moduleId);
    expect(android).toEqual(['home', 'conventions']); // status page is web-only
  });

  it('gives the union of several roles with no duplicates', () => {
    const menu = buildMenu(['event_manager', 'store_manager'], 'web');
    const ids = menu.map((m) => m.moduleId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['home']);
  });

  it('returns nothing for a user with no roles', () => {
    expect(buildMenu([], 'web')).toEqual([]);
  });

  it('hides modules that have not shipped', () => {
    const unshipped = MODULES.filter((m) => !m.shipped).map((m) => m.id);
    const ids = buildMenu(['super_admin', 'admin', 'event_manager', 'store_manager'], 'web').map((m) => m.moduleId);
    for (const id of unshipped) expect(ids).not.toContain(id);
  });

  it('keeps module-map order', () => {
    const order = MODULES.map((m) => m.id);
    const ids = buildMenu(['super_admin'], 'web').map((m) => m.moduleId);
    expect([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(ids);
  });
});
