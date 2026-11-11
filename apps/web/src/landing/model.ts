import type { PublicRouteSummary } from '../api/types.js';

/** How many backdrops the hero mosaic shows in all (four in each row). */
export const MOSAIC_TILES = 8;
/** The poster strip needs to be wider than the screen to have room to slide. */
export const STRIP_MIN_POSTERS = 10;

/** `items` repeated from the start until there are `count` of them. */
function cycle<T>(items: T[], count: number): T[] {
  if (items.length === 0) return [];
  return Array.from({ length: count }, (_, i) => items[i % items.length]!);
}

/**
 * The hero mosaic: two rows of backdrops. A site with few routes still fills
 * both rows (the pictures repeat); one without covers has no mosaic at all.
 */
export function mosaicRows(covers: (string | null)[]): [string[], string[]] {
  const unique = [...new Set(covers.filter((url): url is string => !!url))];
  const tiles = cycle(unique, MOSAIC_TILES);
  return [
    tiles.filter((_, index) => index % 2 === 0),
    tiles.filter((_, index) => index % 2 === 1),
  ];
}

/** The posters of the example route, without gaps and long enough to slide. */
export function stripPosters(posters: (string | null)[]): string[] {
  const present = posters.filter((url): url is string => !!url);
  return cycle(present, Math.max(present.length, STRIP_MIN_POSTERS));
}

/** The route the "example" button opens: the first of the list, in the reader's language if possible (the caller puts the best rated first). */
export function exampleRoute(
  routes: PublicRouteSummary[],
  language: 'es' | 'en',
): PublicRouteSummary | null {
  return routes.find((route) => route.locale === language) ?? routes[0] ?? null;
}

/** Up to three routes to show as cards, preferably in the reader's language. */
export function featuredRoutes(
  routes: PublicRouteSummary[],
  language: 'es' | 'en',
): PublicRouteSummary[] {
  const own = routes.filter((route) => route.locale === language);
  return (own.length > 0 ? own : routes).slice(0, 3);
}
