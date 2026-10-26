import { DEFAULT_LOCALE, LOCALES } from '@film-routes/shared';
import { z } from 'zod';

const locale = z.enum(LOCALES).default(DEFAULT_LOCALE);

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  locale,
  // TMDB does not serve pages beyond 500.
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export const filmParamsSchema = z.object({
  tmdbId: z.coerce.number().int().positive(),
});

export const filmQuerySchema = z.object({ locale });
