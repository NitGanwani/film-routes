import argon2 from 'argon2';

// OWASP's minimum recommended argon2id profile: 19 MiB of memory, 2 passes,
// 1 lane. The parameters are stored inside each hash, so they can be raised
// later without invalidating existing passwords.
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

/** A malformed stored hash counts as a mismatch instead of throwing. */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
