import type { RequestHandler } from 'express';
import { HttpError } from '../errors.js';
import { verifyAccessToken } from './tokens.js';

/** Requires `Authorization: Bearer <access token>` and exposes the user id. */
export function authenticate(secret: string): RequestHandler {
  return async (req, res, next) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    const userId =
      scheme === 'Bearer' && token
        ? await verifyAccessToken(token, secret)
        : null;

    if (!userId) {
      next(
        new HttpError(401, 'unauthorized', 'Missing or invalid access token'),
      );
      return;
    }

    res.locals.userId = userId;
    next();
  };
}
