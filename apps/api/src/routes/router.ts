import { Router } from 'express';
import { authenticate } from '../auth/middleware.js';
import { parseInput } from '../validate.js';
import {
  addStepSchema,
  createRouteSchema,
  reorderSchema,
  routeParamsSchema,
  stepParamsSchema,
  updateRouteSchema,
  updateStepSchema,
} from './schemas.js';
import type { RouteService } from './service.js';

type RoutesRouterOptions = {
  service: RouteService;
  accessSecret: string;
};

/** Everything here belongs to the signed-in author; others get a 404. */
export function createRoutesRouter({
  service,
  accessSecret,
}: RoutesRouterOptions) {
  const router = Router();
  router.use(authenticate(accessSecret));

  router.post('/', async (req, res) => {
    const input = parseInput(createRouteSchema, req.body);
    res.status(201).json({
      route: await service.createRoute(res.locals.userId, input),
    });
  });

  router.get('/', async (_req, res) => {
    res.json({ routes: await service.listRoutes(res.locals.userId) });
  });

  router.get('/:routeId', async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    res.json({ route: await service.getRoute(res.locals.userId, routeId) });
  });

  router.patch('/:routeId', async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    const patch = parseInput(updateRouteSchema, req.body);
    res.json({
      route: await service.updateRoute(res.locals.userId, routeId, patch),
    });
  });

  router.delete('/:routeId', async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    await service.deleteRoute(res.locals.userId, routeId);
    res.status(204).end();
  });

  router.post('/:routeId/steps', async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    const input = parseInput(addStepSchema, req.body);
    res.status(201).json({
      route: await service.addStep(res.locals.userId, routeId, input),
    });
  });

  router.put('/:routeId/steps/order', async (req, res) => {
    const { routeId } = parseInput(routeParamsSchema, req.params);
    const { stepIds } = parseInput(reorderSchema, req.body);
    res.json({
      route: await service.reorderSteps(res.locals.userId, routeId, stepIds),
    });
  });

  router.patch('/:routeId/steps/:stepId', async (req, res) => {
    const { routeId, stepId } = parseInput(stepParamsSchema, req.params);
    const patch = parseInput(updateStepSchema, req.body);
    res.json({
      route: await service.updateStep(
        res.locals.userId,
        routeId,
        stepId,
        patch,
      ),
    });
  });

  router.delete('/:routeId/steps/:stepId', async (req, res) => {
    const { routeId, stepId } = parseInput(stepParamsSchema, req.params);
    res.json({
      route: await service.removeStep(res.locals.userId, routeId, stepId),
    });
  });

  return router;
}
