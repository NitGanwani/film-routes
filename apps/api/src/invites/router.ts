import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate } from '../auth/middleware.js';
import { routeParamsSchema } from '../routes/schemas.js';
import { parseInput } from '../validate.js';
import {
  acceptInviteSchema,
  createInviteSchema,
  inviteParamsSchema,
} from './schemas.js';
import type { InviteService } from './service.js';

type InvitesRouterOptions = {
  service: InviteService;
  accessSecret: string;
  /** Max accept attempts per IP in 15 minutes. */
  acceptAttemptsPer15Min: number;
};

/**
 * Mounted at the app root because it serves two prefixes: the author manages
 * links under /routes/:id/invites, and travelers use them at /invites/accept.
 * Authentication is applied per route so unknown paths still get a plain 404.
 */
export function createInvitesRouter({
  service,
  accessSecret,
  acceptAttemptsPer15Min,
}: InvitesRouterOptions) {
  const router = Router();
  const signedIn = authenticate(accessSecret);

  const acceptLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: acceptAttemptsPer15Min,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'too_many_requests',
          message: 'Too many attempts, try again later',
        },
      });
    },
  });

  router.post('/routes/:routeId/invites', signedIn, async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    const input = parseInput(createInviteSchema, req.body ?? {});
    res.status(201).json({
      invite: await service.createInvite(res.locals.userId, routeId, input),
    });
  });

  router.get('/routes/:routeId/invites', signedIn, async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    res.json({
      invites: await service.listInvites(res.locals.userId, routeId),
    });
  });

  router.delete(
    '/routes/:routeId/invites/:inviteId',
    signedIn,
    async (req, res) => {
      const { routeId, inviteId } = parseInput(inviteParamsSchema, req.params);
      await service.revokeInvite(res.locals.userId, routeId, inviteId);
      res.status(204).end();
    },
  );

  router.post('/invites/accept', signedIn, acceptLimiter, async (req, res) => {
    const { token } = parseInput(acceptInviteSchema, req.body);
    const { created, ...body } = await service.acceptInvite(
      res.locals.userId,
      token,
    );
    res.status(created ? 201 : 200).json(body);
  });

  return router;
}
