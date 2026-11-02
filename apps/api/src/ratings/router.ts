import { Router } from 'express';
import { authenticate } from '../auth/middleware.js';
import { routeParamsSchema } from '../routes/schemas.js';
import { parseInput } from '../validate.js';
import { rateRouteSchema } from './schemas.js';
import type { RatingService } from './service.js';

type RatingsRouterOptions = {
  service: RatingService;
  accessSecret: string;
};

/** Mounted at the app root, next to the other /routes/:id/... features. */
export function createRatingsRouter({
  service,
  accessSecret,
}: RatingsRouterOptions) {
  const router = Router();
  const signedIn = authenticate(accessSecret);

  router.get('/routes/:routeId/rating', signedIn, async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    res.json(await service.getMine(res.locals.userId, routeId));
  });

  router.put('/routes/:routeId/rating', signedIn, async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    const { score } = parseInput(rateRouteSchema, req.body);
    res.json(await service.rate(res.locals.userId, routeId, score));
  });

  return router;
}
