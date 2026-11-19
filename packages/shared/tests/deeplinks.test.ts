import { describe, it, expect } from 'vitest';
import { mobilePath } from '../src/notifications/deeplinks';

describe('deep links (008)', () => {
  it('maps web paths to app screens', () => {
    expect(mobilePath('/events/e1')).toBe('/events/e1');
    expect(mobilePath('/events/e1/checklists/s1')).toBe('/checklist/s1?eventId=e1');
    expect(mobilePath('/approvals/damage/d1')).toBe('/approvals/damage/d1');
    expect(mobilePath('/counts/c1/review')).toBe('/counts/c1');
    expect(mobilePath('/inventory/items/i1')).toBe('/inventory/i1');
    expect(mobilePath('/admin/messages')).toBe('/notifications');
    expect(mobilePath(null)).toBe('/notifications');
  });
});
