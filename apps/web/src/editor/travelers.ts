import type { EnrollmentStatus } from '@film-routes/shared';
import type { Traveler, TravelerStep } from '../api/types.js';
import type { StripFrame } from '../components/FilmStrip.js';

/** The list also returns the people the author removed: they are gone from the page. */
export const visibleTravelers = (travelers: readonly Traveler[]): Traveler[] =>
  travelers.filter((traveler) => traveler.status !== 'removed');

const STATUS_ORDER: Record<EnrollmentStatus, number> = {
  active: 0,
  completed: 1,
  abandoned: 2,
  removed: 3,
};

/** On their way first, then finished, then gone; the most recent to join first inside each. */
export function sortTravelers(travelers: readonly Traveler[]): Traveler[] {
  return [...travelers].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      Date.parse(b.startedAt) - Date.parse(a.startedAt),
  );
}

/** The two numbers of the header: how many are on the route and how many finished it. */
export function travelersSummary(travelers: readonly Traveler[]) {
  return {
    total: travelers.length,
    completed: travelers.filter((traveler) => traveler.status === 'completed')
      .length,
  };
}

/**
 * How many films they felt the same about, out of the ones that can be
 * compared (both of you have an emotion). Null when there is nothing to
 * compare yet, so the page says nothing instead of "0 of 0".
 */
export function matchSummary(steps: readonly TravelerStep[]) {
  const comparable = steps.filter((step) => step.sameEmotion !== null);
  if (comparable.length === 0) return null;
  return {
    same: comparable.filter((step) => step.sameEmotion).length,
    total: comparable.length,
  };
}

/** The strip of the detail: one frame per film, lit with its poster once closed. */
export function journeyFrames(steps: readonly TravelerStep[]): StripFrame[] {
  return steps.map((step) => ({
    posterUrl: step.film.posterUrlSmall ?? step.film.posterUrl,
    state: step.state,
  }));
}
