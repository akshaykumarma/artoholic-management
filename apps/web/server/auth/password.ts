import bcrypt from 'bcrypt';

/** bcrypt cost ≥ 12 outside tests (constitution V). Tests lower it only for speed. */
function cost(): number {
  const configured = Number(process.env.BCRYPT_COST ?? 12);
  if (process.env.NODE_ENV !== 'test' && configured < 12) return 12;
  return configured;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, cost());
}

let dummyHash: Promise<string> | undefined;

/**
 * Compares against a dummy hash when the account is unknown, so response time does not
 * reveal whether a username exists (research R3).
 */
export async function verifyPassword(hash: string | null, plain: string): Promise<boolean> {
  if (!hash) {
    dummyHash ??= bcrypt.hash('dummy-password-for-timing', cost());
    await bcrypt.compare(plain, await dummyHash);
    return false;
  }
  return bcrypt.compare(plain, hash);
}
