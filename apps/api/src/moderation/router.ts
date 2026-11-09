import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAdmin } from '../auth/admin.js';
import { authenticate } from '../auth/middleware.js';
import type { Db } from '../db.js';
import { routeParamsSchema } from '../routes/schemas.js';
import { parseInput } from '../validate.js';
import {
  hideRouteSchema,
  queueQuerySchema,
  reportParamsSchema,
  reportRouteSchema,
} from './schemas.js';
import type { ModerationService } from './service.js';

type ModerationRouterOptions = {
  service: ModerationService;
  db: Db;
  accessSecret: string;
  /** Max reports one account can file in 15 minutes. */
  reportsPer15Min: number;
};

/**
 * Mounted at the app root: people report at /routes/:id/reports, admins work
 * under /admin. Admin routes are protected one by one so unknown paths keep
 * returning a plain 404 instead of revealing that /admin exists.
 */
export function createModerationRouter({
  service,
  db,
  accessSecret,
  reportsPer15Min,
}: ModerationRouterOptions) {
  const router = Router();
  const signedIn = authenticate(accessSecret);
  const adminOnly = [signedIn, requireAdmin(db)];

  // Counted per account (not per IP): the aim is to stop one person flooding
  // the admins' queue, and several people can share an address.
  const reportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: reportsPer15Min,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (_req, res) => res.locals.userId as string,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'too_many_requests',
          message: 'Too many reports, try again later',
        },
      });
    },
  });

  router.post(
    '/routes/:routeId/reports',
    signedIn,
    reportLimiter,
    async (req, res) => {
      const { routeId } = parseInput(routeParamsSchema, req.params);
      const input = parseInput(reportRouteSchema, req.body);
      res.status(201).json({
        report: await service.report(res.locals.userId, routeId, input),
      });
    },
  );

  router.get('/admin/reports', ...adminOnly, async (req, res) => {
    res.json(await service.queue(parseInput(queueQuerySchema, req.query)));
  });

  router.get('/admin/routes/:routeId', ...adminOnly, async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    res.json(await service.getRoute(routeId));
  });

  router.post('/admin/routes/:routeId/hide', ...adminOnly, async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    const input = parseInput(hideRouteSchema, req.body);
    res.json(await service.hide(res.locals.userId, routeId, input));
  });

  router.post(
    '/admin/routes/:routeId/unhide',
    ...adminOnly,
    async (req, res) => {
      const { routeId } = parseInput(routeParamsSchema, req.params);
      await service.unhide(routeId);
      res.status(204).end();
    },
  );

  router.post(
    '/admin/routes/:routeId/reports/dismiss',
    ...adminOnly,
    async (req, res) => {
      const { routeId } = parseInput(routeParamsSchema, req.params);
      res.json(await service.dismissRoute(res.locals.userId, routeId));
    },
  );

  router.post(
    '/admin/reports/:reportId/dismiss',
    ...adminOnly,
    async (req, res) => {
      const { reportId } = parseInput(reportParamsSchema, req.params);
      await service.dismissReport(res.locals.userId, reportId);
      res.status(204).end();
    },
  );

  return router;
}
