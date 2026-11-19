export type PasswordRule = 'length' | 'notIdentifier' | 'notCommon';

/**
 * Password rules (002 FR-009). The common-password check is passed in, so the 10,000-entry list
 * stays on the server; apps can still show the other rules as the user types.
 */
export function passwordProblems(
  password: string,
  identifiers: Array<string | null | undefined>,
  isCommon: (p: string) => boolean = () => false
): PasswordRule[] {
  const problems: PasswordRule[] = [];
  if (password.length < 8) problems.push('length');
  const lower = password.toLowerCase();
  const digits = password.replace(/\D/g, '');
  if (identifiers.some((id) => id && (id.toLowerCase() === lower || (digits.length >= 8 && id.replace(/\D/g, '').endsWith(digits))))) {
    problems.push('notIdentifier');
  }
  if (isCommon(lower)) problems.push('notCommon');
  return problems;
}
