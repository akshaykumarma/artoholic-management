import fs from 'node:fs';
import path from 'node:path';
import { passwordProblems } from '@artoholic/shared';
import { ApiError } from '../http/errors';

let common: Set<string> | undefined;

/**
 * The 10,000 most common passwords (SecLists, MIT licence), lower-cased. Loaded once on first use.
 */
function commonPasswords(): Set<string> {
  if (!common) {
    // The web app always runs with apps/web as its working directory (npm -w, vitest, Docker CMD).
    const candidates = [path.join(process.cwd(), 'server/auth/common-passwords.txt'), path.join(process.cwd(), 'apps/web/server/auth/common-passwords.txt')];
    const file = candidates.find((f) => fs.existsSync(f));
    if (!file) throw new Error('common-passwords.txt not found');
    const text = fs.readFileSync(file, 'utf8');
    common = new Set(text.split('\n').map((l) => l.trim()).filter(Boolean));
  }
  return common;
}

/** Throws PASSWORD_POLICY with the failed rules (002 FR-009). */
export function assertPasswordAllowed(password: string, identifiers: Array<string | null | undefined>): void {
  const rules = passwordProblems(password, identifiers, (p) => commonPasswords().has(p));
  if (rules.length) throw new ApiError('PASSWORD_POLICY', { rules });
}
