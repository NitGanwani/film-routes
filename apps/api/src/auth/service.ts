import type { Locale } from '@film-routes/shared';
import { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../db.js';
import { HttpError } from '../errors.js';
import { sendSafely, type Mailer } from '../mail/mailer.js';
import { passwordResetEmail, verificationEmail } from '../mail/messages.js';
import { createEmailTokens } from './emailTokens.js';
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
  /** Where the web app lives, without a trailing slash: emailed links go here. */
  webUrl: string;
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
  emailVerified: boolean;
  /** Lets the web app show the moderation screens; the API checks again. */
  isAdmin: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const invalidCredentials = () =>
  new HttpError(401, 'invalid_credentials', 'Incorrect email or password');

const invalidLink = () =>
  new HttpError(
    400,
    'invalid_token',
    'This link is not valid or has expired. Ask for a new one.',
  );

const accountGone = () =>
  new HttpError(401, 'unauthorized', 'Account no longer exists');

const invalidRefreshToken = () =>
  new HttpError(401, 'invalid_refresh_token', 'Invalid or expired session');

export function createAuthService(
  db: Db,
  settings: AuthSettings,
  mailer: Mailer,
  now: () => Date = () => new Date(),
) {
  const emailTokens = createEmailTokens(db, now);
  const linkTo = (page: string, token: string) =>
    `${settings.webUrl}/${page}?token=${token}`;
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
    emailVerifiedAt: Date | null;
    role: 'USER' | 'ADMIN';
  }): PublicUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      locale: user.locale === 'ES' ? 'es' : 'en',
      emailVerified: user.emailVerifiedAt !== null,
      isAdmin: user.role === 'ADMIN',
    };
  }

  type Recipient = { id: string; email: string; locale: 'ES' | 'EN' };

  /** Emails the confirmation link. False when one went out a moment ago. */
  async function sendVerification(user: Recipient) {
    const token = await emailTokens.issue(user.id, 'VERIFY_EMAIL');
    if (!token) {
      return false;
    }
    sendSafely(
      mailer,
      verificationEmail(
        user.email,
        user.locale === 'ES' ? 'es' : 'en',
        linkTo('verify-email', token),
      ),
    );
    return true;
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

      // The account exists either way: if the email cannot be prepared, the
      // person can ask for it again from the app.
      await sendVerification(user).catch((error: unknown) => {
        console.error('Could not prepare the verification email', error);
      });

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

    /** Opening the emailed link proves the address is theirs. */
    async verifyEmail(token: string) {
      const stored = await emailTokens.find(token, 'VERIFY_EMAIL');
      if (!stored) {
        throw invalidLink();
      }
      await db.$transaction(async (tx) => {
        if (!(await emailTokens.claim(tx, stored.id))) {
          throw invalidLink();
        }
        await tx.user.updateMany({
          where: { id: stored.userId, emailVerifiedAt: null },
          data: { emailVerifiedAt: now() },
        });
      });
    },

    async resendVerification(userId: string) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw accountGone();
      }
      if (user.emailVerifiedAt) {
        throw new HttpError(
          409,
          'already_verified',
          'Your email is already confirmed',
        );
      }
      if (!(await sendVerification(user))) {
        throw new HttpError(
          429,
          'too_soon',
          'An email was just sent: wait a minute before asking for another',
        );
      }
    },

    /**
     * Always looks the same from outside, whether or not the address has an
     * account, so this cannot be used to find out who is registered.
     */
    async requestPasswordReset(email: string) {
      const user = await db.user.findUnique({ where: { email } });
      if (!user) {
        return;
      }
      const token = await emailTokens.issue(user.id, 'PASSWORD_RESET');
      if (!token) {
        return;
      }
      sendSafely(
        mailer,
        passwordResetEmail(
          user.email,
          user.locale === 'ES' ? 'es' : 'en',
          linkTo('reset-password', token),
        ),
      );
    },

    /**
     * Sets a new password and signs out every device: whoever had the old
     * password (or a stolen session) is shut out. Opening the link also proves
     * the address, so it confirms the email too.
     */
    async resetPassword(token: string, newPassword: string) {
      // Cheap checks first: a bogus link must not make us run argon2.
      const stored = await emailTokens.find(token, 'PASSWORD_RESET');
      if (!stored) {
        throw invalidLink();
      }
      const passwordHash = await hashPassword(newPassword);

      await db.$transaction(async (tx) => {
        if (!(await emailTokens.claim(tx, stored.id))) {
          throw invalidLink();
        }
        await tx.user.update({
          where: { id: stored.userId },
          data: { passwordHash },
        });
        await tx.user.updateMany({
          where: { id: stored.userId, emailVerifiedAt: null },
          data: { emailVerifiedAt: now() },
        });
        await tx.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: now() },
        });
        await tx.userToken.deleteMany({
          where: { userId: stored.userId, usedAt: null },
        });
      });
    },

    /** What closing the account would take with it, to warn before asking. */
    async deletionImpact(userId: string) {
      const [routes, travelers] = await Promise.all([
        db.route.count({ where: { authorId: userId } }),
        db.$queryRaw<{ total: number }[]>`
          SELECT COUNT(DISTINCT e.traveler_id)::int AS total
          FROM enrollments e
          JOIN routes r ON r.id = e.route_id
          WHERE r.author_id = ${userId}::uuid AND e.status <> 'REMOVED'`,
      ]);
      return { routes, travelersAffected: travelers[0]?.total ?? 0 };
    },

    /**
     * Deletes the account and everything that hangs from it (routes, progress,
     * votes, sessions): every link to the user is ON DELETE CASCADE. It asks for
     * the password again, so a stolen session alone cannot do it.
     */
    async deleteAccount(userId: string, password: string) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw accountGone();
      }
      if (!(await verifyPassword(user.passwordHash, password))) {
        throw new HttpError(403, 'incorrect_password', 'Incorrect password');
      }
      await db.user.delete({ where: { id: userId } });
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
