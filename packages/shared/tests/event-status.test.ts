import { describe, it, expect } from 'vitest';
import { canTransition, isEditable } from '../src/events/status';
import { eventWindow, istDate, istInstant, windowsOverlap } from '../src/events/window';

describe('event status (005 FR-009)', () => {
  it('cancels only from Draft or Scheduled', () => {
    expect(canTransition('draft', 'cancelled')).toBe(true);
    expect(canTransition('scheduled', 'cancelled')).toBe(true);
    expect(canTransition('dispatching', 'cancelled')).toBe(false);
    expect(canTransition('scheduled', 'draft')).toBe(false);
  });
  it('follows the lifecycle in order', () => {
    expect(canTransition('draft', 'scheduled')).toBe(true);
    expect(canTransition('at_site', 'returning')).toBe(true);
    expect(canTransition('draft', 'closed')).toBe(false);
    expect(isEditable('scheduled')).toBe(true);
    expect(isEditable('in_transit')).toBe(false);
  });
});

describe('event windows (005 research R1)', () => {
  it('uses the IST date of the leave time', () => {
    expect(istDate('2026-12-01T20:00:00Z')).toBe('2026-12-02');
    expect(eventWindow('2026-12-01T03:30:00Z', '2026-12-04')).toEqual({ start: '2026-12-01', end: '2026-12-04' });
  });
  it('treats touching days as overlapping', () => {
    expect(windowsOverlap({ start: '2026-12-01', end: '2026-12-03' }, { start: '2026-12-03', end: '2026-12-05' })).toBe(true);
    expect(windowsOverlap({ start: '2026-12-01', end: '2026-12-02' }, { start: '2026-12-03', end: '2026-12-05' })).toBe(false);
  });
  it('builds IST wall-clock instants', () => {
    expect(istInstant('2026-12-01', 9).toISOString()).toBe('2026-12-01T03:30:00.000Z');
  });
});
