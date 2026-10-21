import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const ISSUER = 'film-routes';
const ALGORITHM = 'HS256';

const encodeSecret = (secret: string) => new TextEncoder().encode(secret);

type SignOptions = {
  secret: string;
  ttlSeconds: number;
  now?: Date;
};

/** Short-lived JWT identifying the user; the only claim we need is `sub`. */
export function signAccessToken(
  userId: string,
  { secret, ttlSeconds, now = new Date() }: SignOptions,
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT()
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttlSeconds)
    .sign(encodeSecret(secret));
}

/** Returns the user id, or null for any invalid, tampered or expired token. */
export async function verifyAccessToken(
  token: string,
  secret: string,
  now = new Date(),
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(secret), {
      issuer: ISSUER,
      algorithms: [ALGORITHM],
      currentDate: now,
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Refresh tokens are opaque random strings, not JWTs: the server can revoke
 * them because it keeps their hash in the database.
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

// A fast hash is fine here (unlike passwords): the token already has 256 bits
// of entropy, so it cannot be brute-forced, and the database needs a quick,
// deterministic value to look it up by.
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
