import type { Db } from '../db.js';
import type { Tx } from '../routes/locking.js';
import { generateOpaqueToken, hashOpaqueToken } from './tokens.js';

type Purpose = 'VERIFY_EMAIL' | 'PASSWORD_RESET';

const HOUR_MS = 60 * 60 * 1000;

export const EMAIL_TOKEN_TTL_MS: Record<Purpose, number> = {
  VERIFY_EMAIL: 24 * HOUR_MS,
  PASSWORD_RESET: HOUR_MS,
};

/** Asking for another email sooner than this is refused (or ignored). */
export const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Single-use links sent by email. Like invitations and refresh tokens, only a
 * hash is stored: a leaked database cannot be used to take over an account.
 */
export function createEmailTokens(db: Db, now: () => Date) {
  return {
    /**
     * A fresh link for the person, replacing any earlier unused one so only the
     * latest email works. Returns null when one was sent a moment ago, which
     * stops anyone from using us to flood an inbox.
     */
    async issue(userId: string, purpose: Purpose): Promise<string | null> {
      const latest = await db.userToken.findFirst({
        where: { userId, purpose },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (
        latest &&
        now().getTime() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
      ) {
        return null;
      }

      const { token, hash } = generateOpaqueToken();
      await db.$transaction([
        db.userToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
        db.userToken.create({
          data: {
            userId,
            purpose,
            tokenHash: hash,
            expiresAt: new Date(now().getTime() + EMAIL_TOKEN_TTL_MS[purpose]),
          },
        }),
      ]);
      return token;
    },

    /** The link's record if it is real, for this purpose, unused and in date. */
    async find(token: string, purpose: Purpose) {
      const stored = await db.userToken.findUnique({
        where: { tokenHash: hashOpaqueToken(token) },
      });
      if (
        !stored ||
        stored.purpose !== purpose ||
        stored.usedAt ||
        stored.expiresAt <= now()
      ) {
        return null;
      }
      return stored;
    },

    /**
     * Uses the link up. The conditions are checked again inside the update, so
     * of two requests racing with the same link only one gets true.
     */
    async claim(tx: Tx, id: string): Promise<boolean> {
      const claimed = await tx.userToken.updateMany({
        where: { id, usedAt: null, expiresAt: { gt: now() } },
        data: { usedAt: now() },
      });
      return claimed.count === 1;
    },
  };
}
