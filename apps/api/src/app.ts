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
import { createFilmsRouter } from './films/routes.js';
import { createFilmService } from './films/service.js';
import { createRoutesRouter } from './routes/router.js';
import { createRouteService } from './routes/service.js';
import type { TmdbClient } from './tmdb/client.js';

export type AppOptions = {
  corsOrigins: string[];
  db: Db;
  auth: AuthSettings;
  tmdb: TmdbClient;
  /** Override in tests; the default is deliberately strict. */
  authAttemptsPer15Min?: number;
  filmRequestsPerMinute?: number;
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
  authAttemptsPer15Min = 20,
  filmRequestsPerMinute = 60,
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
      service: createAuthService(db, auth),
      settings: auth,
      attemptsPer15Min: authAttemptsPer15Min,
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

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
