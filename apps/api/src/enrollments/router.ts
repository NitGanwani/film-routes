import { Router } from 'express';
import { authenticate } from '../auth/middleware.js';
import { routeParamsSchema } from '../routes/schemas.js';
import { parseInput } from '../validate.js';
import { z } from 'zod';
import type { EnrollmentService } from './service.js';

const travelerParamsSchema = routeParamsSchema.extend({
  enrollmentId: z.uuid(),
});

type EnrollmentsRouterOptions = {
  service: EnrollmentService;
  accessSecret: string;
};

/** The author's view of who is following a route. Mounted at the app root. */
export function createEnrollmentsRouter({
  service,
  accessSecret,
}: EnrollmentsRouterOptions) {
  const router = Router();
  const signedIn = authenticate(accessSecret);

  router.get('/routes/:routeId/travelers', signedIn, async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    res.json({
      travelers: await service.listTravelers(res.locals.userId, routeId),
    });
  });

  router.delete(
    '/routes/:routeId/travelers/:enrollmentId',
    signedIn,
    async (req, res) => {
      const { routeId, enrollmentId } = parseInput(
        travelerParamsSchema,
        req.params,
      );
      await service.removeTraveler(res.locals.userId, routeId, enrollmentId);
      res.status(204).end();
    },
  );

  return router;
}
