import { Router } from 'express';
import { authenticate } from '../auth/middleware.js';
import { routeParamsSchema, stepParamsSchema } from '../routes/schemas.js';
import { parseInput } from '../validate.js';
import { closeStepSchema, travelerParamsSchema } from './schemas.js';
import type { ProgressService } from './service.js';

type ProgressRouterOptions = {
  service: ProgressService;
  accessSecret: string;
};

/**
 * Mounted at the app root: travelers use /journeys and /routes/:id/journey,
 * and the author reads a traveler's comparison under /routes/:id/travelers.
 */
export function createProgressRouter({
  service,
  accessSecret,
}: ProgressRouterOptions) {
  const router = Router();
  const signedIn = authenticate(accessSecret);

  router.get('/journeys', signedIn, async (_req, res) => {
    res.json({ journeys: await service.listJourneys(res.locals.userId) });
  });

  router.get('/routes/:routeId/journey', signedIn, async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    res.json({ journey: await service.getJourney(res.locals.userId, routeId) });
  });

  router.post(
    '/routes/:routeId/journey/steps/:stepId/start',
    signedIn,
    async (req, res) => {
      const { routeId, stepId } = parseInput(stepParamsSchema, req.params);
      res.json({
        journey: await service.startStep(res.locals.userId, routeId, stepId),
      });
    },
  );

  router.post(
    '/routes/:routeId/journey/steps/:stepId/close',
    signedIn,
    async (req, res) => {
      const { routeId, stepId } = parseInput(stepParamsSchema, req.params);
      const input = parseInput(closeStepSchema, req.body);
      res.json({
        journey: await service.closeStep(
          res.locals.userId,
          routeId,
          stepId,
          input,
        ),
      });
    },
  );

  router.post('/routes/:routeId/journey/leave', signedIn, async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    await service.leave(res.locals.userId, routeId);
    res.status(204).end();
  });

  router.get(
    '/routes/:routeId/travelers/:enrollmentId/journey',
    signedIn,
    async (req, res) => {
      const { routeId, enrollmentId } = parseInput(
        travelerParamsSchema,
        req.params,
      );
      res.json(
        await service.getTravelerJourney(
          res.locals.userId,
          routeId,
          enrollmentId,
        ),
      );
    },
  );

  return router;
}
