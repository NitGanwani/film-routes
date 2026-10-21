import { describe, expect, it } from 'vitest';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from './tokens.js';

const secret = 'a'.repeat(32);
const userId = '0192f0c0-0000-7000-8000-000000000001';

describe('access tokens', () => {
  it('round-trips the user id', async () => {
    const token = await signAccessToken(userId, { secret, ttlSeconds: 900 });

    expect(await verifyAccessToken(token, secret)).toBe(userId);
  });

  it('rejects a token signed with another secret', async () => {
    const token = await signAccessToken(userId, { secret, ttlSeconds: 900 });

    expect(await verifyAccessToken(token, 'b'.repeat(32))).toBeNull();
  });

  it('rejects an expired token', async () => {
    const issuedAt = new Date('2026-01-01T00:00:00Z');
    const token = await signAccessToken(userId, {
      secret,
      ttlSeconds: 900,
      now: issuedAt,
    });

    const justBefore = new Date('2026-01-01T00:14:59Z');
    const justAfter = new Date('2026-01-01T00:15:01Z');
    expect(await verifyAccessToken(token, secret, justBefore)).toBe(userId);
    expect(await verifyAccessToken(token, secret, justAfter)).toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const token = await signAccessToken(userId, { secret, ttlSeconds: 900 });
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'someone-else', iss: 'film-routes' }),
    ).toString('base64url');

    expect(
      await verifyAccessToken(
        `${header}.${forgedPayload}.${signature}`,
        secret,
      ),
    ).toBeNull();
  });

  it('rejects garbage', async () => {
    expect(await verifyAccessToken('not.a.jwt', secret)).toBeNull();
    expect(await verifyAccessToken('', secret)).toBeNull();
  });
});

describe('refresh tokens', () => {
  it('generates a different 256-bit token every time', () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();

    expect(first.token).not.toBe(second.token);
    expect(first.token).toHaveLength(43); // 32 bytes in base64url
  });

  it('returns the hash that will be stored, never the token itself', () => {
    const { token, hash } = generateRefreshToken();

    expect(hash).toBe(hashRefreshToken(token));
    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
