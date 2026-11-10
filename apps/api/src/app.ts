import cors from 'cors';
import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from 'express';
import helmet from 'helmet';
import { createAuthRouter } from './auth/routes.js';
import { createAuthService, type AuthSettings } from './auth/service.js';
import type { Db } from './db.js';
import { HttpError } from './errors.js';
import type { Mailer } from './mail/mailer.js';
import { createFilmsRouter } from './films/routes.js';
import { createFilmService } from './films/service.js';
import { createEnrollmentsRouter } from './enrollments/router.js';
import { createEnrollmentService } from './enrollments/service.js';
import { createInvitesRouter } from './invites/router.js';
import { createInviteService } from './invites/service.js';
import { createModerationRouter } from './moderation/router.js';
import { createModerationService } from './moderation/service.js';
import { createProgressRouter } from './progress/router.js';
import { createProgressService } from './progress/service.js';
import { createPublicRouter } from './public/router.js';
import { createPublicService } from './public/service.js';
import { createRatingsRouter } from './ratings/router.js';
import { createRatingService } from './ratings/service.js';
import { createRoutesRouter } from './routes/router.js';
import { createRouteService } from './routes/service.js';
import type { TmdbClient } from './tmdb/client.js';

export type AppOptions = {
  corsOrigins: string[];
  db: Db;
  auth: AuthSettings;
  tmdb: TmdbClient;
  /** Sends the emails (confirm address, reset password). */
  mailer: Mailer;
  /** Override in tests; the default is deliberately strict. */
  authAttemptsPer15Min?: number;
  authRefreshesPer15Min?: number;
  filmRequestsPerMinute?: number;
  inviteAcceptAttemptsPer15Min?: number;
  publicRequestsPerMinute?: number;
  reportsPer15Min?: number;
};

const notFound: RequestHandler = (_req, res) => {
  res
    .status(404)
    .json({ error: { code: 'not_found', message: 'Route not found' } });
};

// Express 5 forwards errors from async handlers here automatically.
const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message } });
    return;
  }

  // Unknown errors are logged but never leaked to the client.
  console.error(error);
  res.status(500).json({
    error: { code: 'internal_error', message: 'Internal server error' },
  });
};

export function createApp({
  corsOrigins,
  db,
  auth,
  tmdb,
  mailer,
  authAttemptsPer15Min = 20,
  authRefreshesPer15Min = 300,
  filmRequestsPerMinute = 60,
  inviteAcceptAttemptsPer15Min = 30,
  publicRequestsPerMinute = 60,
  reportsPer15Min = 10,
}: AppOptions) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(
    '/auth',
    createAuthRouter({
      service: createAuthService(db, auth, mailer),
      settings: auth,
      attemptsPer15Min: authAttemptsPer15Min,
      refreshesPer15Min: authRefreshesPer15Min,
    }),
  );

  const filmService = createFilmService(db, tmdb);

  app.use(
    '/films',
    createFilmsRouter({
      service: filmService,
      accessSecret: auth.accessSecret,
      requestsPerMinute: filmRequestsPerMinute,
    }),
  );

  app.use(
    '/routes',
    createRoutesRouter({
      service: createRouteService(db, filmService),
      accessSecret: auth.accessSecret,
    }),
  );

  app.use(
    createInvitesRouter({
      service: createInviteService(db),
      accessSecret: auth.accessSecret,
      acceptAttemptsPer15Min: inviteAcceptAttemptsPer15Min,
    }),
  );

  app.use(
    createEnrollmentsRouter({
      service: createEnrollmentService(db),
      accessSecret: auth.accessSecret,
    }),
  );

  app.use(
    '/public',
    createPublicRouter({
      service: createPublicService(db),
      accessSecret: auth.accessSecret,
      requestsPerMinute: publicRequestsPerMinute,
    }),
  );

  app.use(
    createProgressRouter({
      service: createProgressService(db),
      accessSecret: auth.accessSecret,
    }),
  );

  app.use(
    createRatingsRouter({
      service: createRatingService(db),
      accessSecret: auth.accessSecret,
    }),
  );

  app.use(
    createModerationRouter({
      service: createModerationService(db),
      db,
      accessSecret: auth.accessSecret,
      reportsPer15Min,
    }),
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
