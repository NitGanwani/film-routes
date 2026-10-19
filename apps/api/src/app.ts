import cors from 'cors';
import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from 'express';
import helmet from 'helmet';
import { HttpError } from './errors.js';

export type AppOptions = {
  corsOrigins: string[];
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

export function createApp({ corsOrigins }: AppOptions) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
