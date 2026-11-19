import { describe, it, expect } from 'vitest';
import { dueDate, nextDueAfter, nextDueOnOrAfter } from '../src/counts/schedule';

describe('count schedule due dates (007 research R1)', () => {
  it('clamps the 31st to the end of shorter months and keeps the anchor day', () => {
    expect([0, 1, 2, 3].map((k) => dueDate('2027-01-31', 'monthly', k))).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });
  it('handles weekly, quarterly, half-yearly and yearly', () => {
    expect(dueDate('2026-12-01', 'weekly', 1)).toBe('2026-12-08');
    expect(dueDate('2026-11-30', 'quarterly', 1)).toBe('2027-02-28');
    expect(dueDate('2026-08-31', 'half_yearly', 1)).toBe('2027-02-28');
    expect(dueDate('2028-02-29', 'yearly', 1)).toBe('2029-02-28');
  });
  it('gives the next due date and skips missed periods on resume', () => {
    expect(nextDueAfter('2026-12-01', 'monthly', '2026-12-01')).toBe('2027-01-01');
    expect(nextDueOnOrAfter('2026-12-01', 'monthly', '2027-03-15')).toBe('2027-04-01');
    expect(nextDueOnOrAfter('2026-12-01', 'monthly', '2026-11-01')).toBe('2026-12-01');
  });
});
