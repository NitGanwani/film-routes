import { ROUTE_LIMITS, type Locale } from '@film-routes/shared';
import type {
  AuthorRouteDetail,
  AuthorStep,
  FilmSearchResult,
} from '../api/types.js';

/** What the search asks for as soon as it has this many letters. */
export const SEARCH_MIN_LENGTH = 2;
/** How long to wait after the last key before searching. */
export const SEARCH_DELAY_MS = 300;
/** The API accepts up to 100 characters. */
export const SEARCH_MAX_LENGTH = 100;

/**
 * What is searched: the text without the spaces around it or doubled inside.
 * Null while it is too short to be worth a request.
 */
export function searchTerm(input: string): string | null {
  const term = input.trim().replace(/\s+/g, ' ');
  return term.length >= SEARCH_MIN_LENGTH ? term : null;
}

export type FilmsState = {
  count: number;
  /** One more film can be added. */
  canAdd: boolean;
  /** The ten are there. */
  full: boolean;
  /** How many films are still missing to reach the minimum (0 once there). */
  missing: number;
};

export function filmsState(count: number): FilmsState {
  return {
    count,
    canAdd: count < ROUTE_LIMITS.maxSteps,
    full: count >= ROUTE_LIMITS.maxSteps,
    missing: Math.max(0, ROUTE_LIMITS.minSteps - count),
  };
}

/** A film keeps this key from the moment it is added until it is removed. */
export const stepKey = (step: Pick<AuthorStep, 'film'>) =>
  String(step.film.tmdbId);

const PENDING_PREFIX = 'pending-';

/** A film added on screen that the server has not confirmed yet. */
export const isPendingStep = (step: Pick<AuthorStep, 'id'>) =>
  step.id.startsWith(PENDING_PREFIX);

/**
 * The step a search result will become, for showing it before the server
 * answers. The search gives the title in one language only, so both are filled
 * with it until the real route arrives a moment later.
 */
export function stepFromResult(
  result: FilmSearchResult,
  position: number,
): AuthorStep {
  const titles = { es: result.title, en: result.title } satisfies Record<
    Locale,
    string
  >;
  return {
    id: `${PENDING_PREFIX}${result.tmdbId}`,
    position,
    noteBefore: null,
    noteAfter: null,
    authorEmotion: null,
    film: {
      tmdbId: result.tmdbId,
      title: result.title,
      titles,
      originalTitle: result.originalTitle,
      releaseYear: result.releaseYear,
      runtimeMinutes: null,
      posterUrl: result.posterUrl,
      posterUrlSmall: result.posterUrlSmall,
      backdropUrl: result.backdropUrl,
    },
  };
}

/** Positions are always 1, 2, 3… with no gaps. */
const renumber = (steps: AuthorStep[]): AuthorStep[] =>
  steps.map((step, index) => ({ ...step, position: index + 1 }));

/** The route with one more film at the end (unchanged if it is there or full). */
export function withStepAdded(
  route: AuthorRouteDetail,
  result: FilmSearchResult,
): AuthorRouteDetail {
  if (
    route.steps.length >= ROUTE_LIMITS.maxSteps ||
    route.steps.some((step) => step.film.tmdbId === result.tmdbId)
  ) {
    return route;
  }
  return {
    ...route,
    steps: [...route.steps, stepFromResult(result, route.steps.length + 1)],
  };
}

export function withStepRemoved(
  route: AuthorRouteDetail,
  stepId: string,
): AuthorRouteDetail {
  return {
    ...route,
    steps: renumber(route.steps.filter((step) => step.id !== stepId)),
  };
}

/**
 * The route with its films in the order of `stepIds`. An id list that does not
 * name exactly the films that are there is ignored: better the old order than a
 * lost film.
 */
export function withStepsOrdered(
  route: AuthorRouteDetail,
  stepIds: string[],
): AuthorRouteDetail {
  const byId = new Map(route.steps.map((step) => [step.id, step]));
  const ordered = stepIds.flatMap((id) => byId.get(id) ?? []);
  if (
    ordered.length !== route.steps.length ||
    byId.size !== new Set(stepIds).size
  ) {
    return route;
  }
  return { ...route, steps: renumber(ordered) };
}

/** `items` with the one at `from` moved to `to` (both clamped into the list). */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return items;
  const target = Math.min(Math.max(to, 0), items.length - 1);
  if (target === from) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved as T);
  return next;
}

/**
 * Changing the films of a route that travelers already follow is refused with
 * "route_locked" (409). A 423 would mean the same.
 */
export function isLockedRefusal(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { status, code } = error as { status?: unknown; code?: unknown };
  return status === 423 || code === 'route_locked';
}
