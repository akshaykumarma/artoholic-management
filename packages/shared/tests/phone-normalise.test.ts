import { describe, it, expect } from 'vitest';
import { normalisePhone } from '../src/format/phone-normalise';

describe('normalisePhone (002 edge cases)', () => {
  it.each(['98765 43210', '+91-98765-43210', '09876543210', '+919876543210', '(+91) 98765 43210'])('%s → +919876543210', (input) => {
    expect(normalisePhone(input)).toBe('+919876543210');
  });
  it('keeps other countries', () => {
    expect(normalisePhone('+1 415 555 2671')).toBe('+14155552671');
  });
  it.each(['12345', 'abc', 'owner@example.com', ''])('rejects %s', (input) => {
    expect(normalisePhone(input)).toBeNull();
  });
});
