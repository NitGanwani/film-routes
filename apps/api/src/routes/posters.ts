import type { Prisma } from '../../generated/prisma/client.js';
import { posterUrl } from '../films/service.js';

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
    select: { film: { select: { posterPath: true } } },
  },
} satisfies Prisma.RouteSelect;

type PosterRow = { film: { posterPath: string | null } };

/** One entry per film; `null` where TMDB has no poster (the card shows a stand-in). */
export const toPosters = (steps: PosterRow[]) =>
  steps
    .slice(0, POSTERS_PER_CARD)
    .map((step) => posterUrl(step.film.posterPath));
