import type { Db } from '../db.js';
import { HttpError } from '../errors.js';

/**
 * Sharing a route, inviting, rating and reporting need a confirmed email:
 * those are the actions that invite spam. Browsing and following routes do not.
 */
export async function assertEmailVerified(db: Db, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  if (!user) {
    // A valid token for a deleted account.
    throw new HttpError(401, 'unauthorized', 'Account no longer exists');
  }
  if (!user.emailVerifiedAt) {
    throw new HttpError(
      403,
      'email_not_verified',
      'Confirm your email address first',
    );
  }
}
