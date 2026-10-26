import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate } from '../auth/middleware.js';
import { parseInput } from '../validate.js';
import {
  filmParamsSchema,
  filmQuerySchema,
  searchQuerySchema,
} from './schemas.js';
import type { FilmService } from './service.js';

type FilmsRouterOptions = {
  service: FilmService;
  accessSecret: string;
  /** Max requests per IP per minute; protects our TMDB quota. */
  requestsPerMinute: number;
};

export function createFilmsRouter({
  service,
  accessSecret,
  requestsPerMinute,
}: FilmsRouterOptions) {
  const router = Router();

  // Only signed-in users can search, so anonymous traffic cannot burn our
  // TMDB quota; the limiter covers a signed-in user going overboard.
  router.use(authenticate(accessSecret));
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

  router.get('/search', async (req, res) => {
    const { q, locale, page } = parseInput(searchQuerySchema, req.query);
    res.json(await service.searchFilms(q, locale, page));
  });

  router.get('/:tmdbId', async (req, res) => {
    const { tmdbId } = parseInput(filmParamsSchema, req.params);
    const { locale } = parseInput(filmQuerySchema, req.query);
    res.json({ film: await service.getFilm(tmdbId, locale) });
  });

  return router;
}
