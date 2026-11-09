import type { RequestHandler } from 'express';
import type { Db } from '../db.js';
import { HttpError } from '../errors.js';

/**
 * Lets only admins through. Run it after `authenticate`.
 *
 * The role is read from the database on every request, never from the token:
 * a token lives for minutes and cannot be taken back, so an admin whose role is
 * removed (or whose account is taken over) would keep their power until it
 * expired. One indexed lookup per admin request is a fair price.
 */
export function requireAdmin(db: Db): RequestHandler {
  return async (_req, res, next) => {
    const user = await db.user.findUnique({
      where: { id: res.locals.userId as string },
      select: { role: true },
    });
    if (!user) {
      next(new HttpError(401, 'unauthorized', 'Account no longer exists'));
      return;
    }
    if (user.role !== 'ADMIN') {
      next(new HttpError(403, 'forbidden', 'Administrators only'));
      return;
    }
    next();
  };
}
