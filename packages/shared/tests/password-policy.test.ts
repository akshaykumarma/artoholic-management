import { describe, it, expect } from 'vitest';
import { passwordProblems } from '../src/auth/password-policy';

describe('password policy (FR-009)', () => {
  it('requires 8 characters', () => expect(passwordProblems('short', [])).toEqual(['length']));
  it('refuses the username, email or phone', () => {
    expect(passwordProblems('ravi.kumar', ['ravi.kumar'])).toContain('notIdentifier');
    expect(passwordProblems('RAVI@EXAMPLE.COM', ['ravi@example.com'])).toContain('notIdentifier');
    expect(passwordProblems('9876543210', ['+919876543210'])).toContain('notIdentifier');
  });
  it('refuses common passwords via the supplied check', () => {
    expect(passwordProblems('password123', [], (p) => p === 'password123')).toEqual(['notCommon']);
  });
  it('accepts a good password', () => expect(passwordProblems('marigold-tent-42', ['ravi', '+919876543210'])).toEqual([]));
});
