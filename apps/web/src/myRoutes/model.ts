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
