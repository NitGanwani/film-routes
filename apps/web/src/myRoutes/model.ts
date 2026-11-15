import { ROUTE_LIMITS, type RouteVisibility } from '@film-routes/shared';
import type { IconName } from '../components/Icon.js';

/**
 * One icon per visibility, so the state never depends on a word alone:
 * a padlock (only me), a link (whoever has it) and a globe (everyone).
 */
export const VISIBILITY_ICON = {
  private: 'lock',
  unlisted: 'link',
  public: 'globe',
} as const satisfies Record<RouteVisibility, IconName>;

/** How many films a route still needs before it can be shared; 0 once it has enough. */
export function missingFilms(stepCount: number): number {
  return Math.max(0, ROUTE_LIMITS.minSteps - stepCount);
}

/**
 * The route the person left unfinished (fewer films than it needs to be
 * shared), to offer to carry on with it. `routes` comes most recently changed
 * first, so it is the one they touched last. A route taken down by a moderator
 * or without a title is not offered: there is nothing to carry on with.
 */
export function unfinishedRoute<
  T extends { stepCount: number; hidden: boolean; title: string },
>(routes: readonly T[]): T | null {
  return (
    routes.find(
      (route) =>
        missingFilms(route.stepCount) > 0 &&
        !route.hidden &&
        route.title.trim() !== '',
    ) ?? null
  );
}
