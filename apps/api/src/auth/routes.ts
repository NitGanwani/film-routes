import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from '../errors.js';
import { parseInput } from '../validate.js';
import { authenticate } from './middleware.js';
import { loginSchema, refreshTokenSchema, registerSchema } from './schemas.js';
import type { AuthService, AuthSettings } from './service.js';

type AuthRouterOptions = {
  service: AuthService;
  settings: AuthSettings;
  /** Max register / login / refresh attempts per IP in 15 minutes. */
  attemptsPer15Min: number;
};

export function createAuthRouter({
  service,
  settings,
  attemptsPer15Min,
}: AuthRouterOptions) {
  const router = Router();

  // Slows down password guessing and account spam from a single address.
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: attemptsPer15Min,
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

  router.post('/register', limiter, async (req, res) => {
    const input = parseInput(registerSchema, req.body);
    res.status(201).json(await service.register(input));
  });

  router.post('/login', limiter, async (req, res) => {
    const input = parseInput(loginSchema, req.body);
    res.json(await service.login(input));
  });

  router.post('/refresh', limiter, async (req, res) => {
    const { refreshToken } = parseInput(refreshTokenSchema, req.body);
    res.json(await service.refresh(refreshToken));
  });

  router.post('/logout', async (req, res) => {
    const { refreshToken } = parseInput(refreshTokenSchema, req.body);
    await service.logout(refreshToken);
    res.status(204).end();
  });

  router.get('/me', authenticate(settings.accessSecret), async (_req, res) => {
    const user = await service.getUser(res.locals.userId);
    if (!user) {
      // A valid token for a deleted account.
      throw new HttpError(401, 'unauthorized', 'Account no longer exists');
    }
    res.json({ user });
  });

  return router;
}
