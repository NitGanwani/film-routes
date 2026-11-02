import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate } from '../auth/middleware.js';
import { routeParamsSchema } from '../routes/schemas.js';
import { parseInput } from '../validate.js';
import { listQuerySchema } from './schemas.js';
import type { PublicService } from './service.js';

type PublicRouterOptions = {
  service: PublicService;
  accessSecret: string;
  /** Max requests per IP per minute; browsing needs no account. */
  requestsPerMinute: number;
};

/** Mounted at /public: browsing is open to anyone, joining needs an account. */
export function createPublicRouter({
  service,
  accessSecret,
  requestsPerMinute,
}: PublicRouterOptions) {
  const router = Router();

  router.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: requestsPerMinute,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          error: {
            code: 'too_many_requests',
            message: 'Too many requests, try again later',
          },
        });
      },
    }),
  );

  // A short cache means repeated visits do not hit the database every time.
  // The price: an unpublished route can still show for up to 30 seconds.
  const cacheBriefly: RequestHandler = (_req, res, next) => {
    res.set('Cache-Control', 'public, max-age=30');
    next();
  };

  router.get('/routes', cacheBriefly, async (req, res) => {
    const query = parseInput(listQuerySchema, req.query);
    res.json(await service.listRoutes(query));
  });

  router.get('/routes/:routeId', cacheBriefly, async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    res.json({ route: await service.getRoute(routeId) });
  });

  router.post(
    '/routes/:routeId/join',
    authenticate(accessSecret),
    async (req, res) => {
      const { routeId } = parseInput(routeParamsSchema, req.params);
      const { created, ...body } = await service.joinRoute(
        res.locals.userId,
        routeId,
      );
      res.status(created ? 201 : 200).json(body);
    },
  );

  return router;
}
