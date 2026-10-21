import type { Locale } from '@film-routes/shared';
import { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../db.js';
import { HttpError } from '../errors.js';
import { hashPassword, verifyPassword } from './passwords.js';
import type { LoginInput, RegisterInput } from './schemas.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from './tokens.js';

export type AuthSettings = {
  accessSecret: string;
  accessTtlSeconds: number;
  refreshTtlDays: number;
};

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Seconds until the access token expires. */
  expiresIn: number;
};

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  locale: Locale;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const invalidCredentials = () =>
  new HttpError(401, 'invalid_credentials', 'Incorrect email or password');

const invalidRefreshToken = () =>
  new HttpError(401, 'invalid_refresh_token', 'Invalid or expired session');

export function createAuthService(
  db: Db,
  settings: AuthSettings,
  now: () => Date = () => new Date(),
) {
  // Verified against when the email does not exist, so a missing account takes
  // as long to reject as a wrong password and login does not reveal which
  // emails are registered.
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = () =>
    (dummyHash ??= hashPassword('not-a-real-password'));

  function toPublicUser(user: {
    id: string;
    username: string;
    email: string;
    locale: 'ES' | 'EN';
  }): PublicUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      locale: user.locale === 'ES' ? 'es' : 'en',
    };
  }

  async function issueTokens(userId: string): Promise<Tokens> {
    const issuedAt = now();
    const { token, hash } = generateRefreshToken();
    await db.refreshToken.create({
      data: {
        userId,
        tokenHash: hash,
        expiresAt: new Date(
          issuedAt.getTime() + settings.refreshTtlDays * DAY_MS,
        ),
      },
    });
    const accessToken = await signAccessToken(userId, {
      secret: settings.accessSecret,
      ttlSeconds: settings.accessTtlSeconds,
      now: issuedAt,
    });
    return {
      accessToken,
      refreshToken: token,
      tokenType: 'Bearer',
      expiresIn: settings.accessTtlSeconds,
    };
  }

  /** Signs out every device: used when a refresh token is replayed. */
  async function revokeAllTokens(userId: string) {
    await db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now() },
    });
  }

  return {
    async register(input: RegisterInput) {
      const passwordHash = await hashPassword(input.password);

      let user;
      try {
        user = await db.user.create({
          data: {
            username: input.username,
            email: input.email,
            passwordHash,
            locale: input.locale === 'es' ? 'ES' : 'EN',
          },
        });
      } catch (error) {
        // One message for both fields: saying "email taken" would let anyone
        // check whether an address has an account.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new HttpError(
            409,
            'account_conflict',
            'Username or email already in use',
          );
        }
        throw error;
      }

      return { user: toPublicUser(user), tokens: await issueTokens(user.id) };
    },

    async login(input: LoginInput) {
      const user = await db.user.findUnique({ where: { email: input.email } });
      const passwordMatches = await verifyPassword(
        user?.passwordHash ?? (await getDummyHash()),
        input.password,
      );
      if (!user || !passwordMatches) {
        throw invalidCredentials();
      }

      return { user: toPublicUser(user), tokens: await issueTokens(user.id) };
    },

    /**
     * Rotation: every refresh token works exactly once. Presenting one that was
     * already used means it leaked (or the client is buggy), so we revoke the
     * whole family and force a new login.
     */
    async refresh(refreshToken: string) {
      const stored = await db.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(refreshToken) },
      });
      if (!stored) {
        throw invalidRefreshToken();
      }
      if (stored.revokedAt) {
        await revokeAllTokens(stored.userId);
        throw invalidRefreshToken();
      }
      if (stored.expiresAt <= now()) {
        throw invalidRefreshToken();
      }

      // Conditional update: if two requests race with the same token, only one
      // can flip revokedAt from null. The loser is treated as a replay.
      const claimed = await db.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now() },
      });
      if (claimed.count === 0) {
        await revokeAllTokens(stored.userId);
        throw invalidRefreshToken();
      }

      return { tokens: await issueTokens(stored.userId) };
    },

    /** Idempotent: an unknown or already revoked token is not an error. */
    async logout(refreshToken: string) {
      await db.refreshToken.updateMany({
        where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
        data: { revokedAt: now() },
      });
    },

    async getUser(userId: string): Promise<PublicUser | null> {
      const user = await db.user.findUnique({ where: { id: userId } });
      return user ? toPublicUser(user) : null;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
