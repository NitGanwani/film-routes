import type { Prisma } from '../../generated/prisma/client.js';
import { imageUrl } from '../films/images.js';

/**
 * How many posters a route card shows. Posters are not spoilers: the films of
 * a route are visible to anyone who can see the route at all.
 */
export const POSTERS_PER_CARD = 4;

/** Add to a route `select` to load the first films' posters, in route order. */
export const postersSelect = {
  steps: {
    orderBy: { position: 'asc' },
    take: POSTERS_PER_CARD,
    select: {
      film: { select: { posterPath: true, backdropPath: true } },
    },
  },
} satisfies Prisma.RouteSelect;

type PosterRow = {
  film: { posterPath: string | null; backdropPath: string | null };
};

/** One entry per film; `null` where TMDB has no poster (the card shows a stand-in). */
export const toPosters = (steps: PosterRow[]) =>
  steps
    .slice(0, POSTERS_PER_CARD)
    .map((step) => imageUrl(step.film.posterPath, 'w185'));

/** The wide image that represents a route: the backdrop of its first film. */
export const toCoverUrl = (steps: PosterRow[]) =>
  imageUrl(steps[0]?.film.backdropPath ?? null, 'w1280');
