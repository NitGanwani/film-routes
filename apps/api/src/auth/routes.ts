import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from '../errors.js';
import { parseInput } from '../validate.js';
import { authenticate } from './middleware.js';
import {
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './schemas.js';
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

  const signedIn = authenticate(settings.accessSecret);

  router.get('/me', signedIn, async (_req, res) => {
    const user = await service.getUser(res.locals.userId);
    if (!user) {
      // A valid token for a deleted account.
      throw new HttpError(401, 'unauthorized', 'Account no longer exists');
    }
    res.json({ user });
  });

  router.post('/verify-email', limiter, async (req, res) => {
    const { token } = parseInput(verifyEmailSchema, req.body);
    await service.verifyEmail(token);
    res.status(204).end();
  });

  router.post('/verify-email/resend', signedIn, limiter, async (_req, res) => {
    await service.resendVerification(res.locals.userId);
    res.status(204).end();
  });

  // 204 whether or not the address has an account: nothing to learn from it.
  router.post('/password/forgot', limiter, async (req, res) => {
    const { email } = parseInput(forgotPasswordSchema, req.body);
    await service.requestPasswordReset(email);
    res.status(204).end();
  });

  router.post('/password/reset', limiter, async (req, res) => {
    const { token, password } = parseInput(resetPasswordSchema, req.body);
    await service.resetPassword(token, password);
    res.status(204).end();
  });

  router.get('/me/deletion-impact', signedIn, async (_req, res) => {
    res.json(await service.deletionImpact(res.locals.userId));
  });

  router.delete('/me', signedIn, limiter, async (req, res) => {
    const { password } = parseInput(deleteAccountSchema, req.body);
    await service.deleteAccount(res.locals.userId, password);
    res.status(204).end();
  });

  return router;
}
