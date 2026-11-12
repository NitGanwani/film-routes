import { ROUTE_LIMITS, type RouteVisibility } from '@film-routes/shared';

/** What a route needs before it can be shared (anything but private). */
export type ShareMissing = 'films' | 'email';

export type ShareRequirements = {
  /** How many films it has now. */
  count: number;
  filmsOk: boolean;
  emailOk: boolean;
  /** What is still missing, in the order they are listed. */
  missing: ShareMissing[];
};

export function shareRequirements(input: {
  stepCount: number;
  emailVerified: boolean;
}): ShareRequirements {
  const filmsOk =
    input.stepCount >= ROUTE_LIMITS.minSteps &&
    input.stepCount <= ROUTE_LIMITS.maxSteps;
  const missing: ShareMissing[] = [];
  if (!filmsOk) missing.push('films');
  if (!input.emailVerified) missing.push('email');
  return {
    count: input.stepCount,
    filmsOk,
    emailOk: input.emailVerified,
    missing,
  };
}

/**
 * Whether an option can be picked. Going back to private is always possible;
 * sharing needs every requirement.
 */
export function canChoose(
  option: RouteVisibility,
  requirements: ShareRequirements,
): boolean {
  return option === 'private' || requirements.missing.length === 0;
}

/**
 * The warning before sharing a route for the first time: once somebody joins
 * the films are frozen. It makes no sense once the route is already locked.
 */
export function needsShareWarning(input: {
  current: RouteVisibility;
  next: RouteVisibility;
  locked: boolean;
}): boolean {
  return (
    !input.locked && input.current === 'private' && input.next !== 'private'
  );
}

/** The public page of a route, as it is shared. */
export const shareLink = (origin: string, routeId: string) =>
  `${origin}/routes/${routeId}`;

/** Only a route with enough work in it asks for its title before it is deleted. */
export const deleteNeedsTitle = (stepCount: number) =>
  stepCount >= ROUTE_LIMITS.minSteps;

const squash = (value: string) => value.trim().replace(/\s+/g, ' ');

/** The typed title against the real one: the spaces around and inside do not count. */
export const titleMatches = (typed: string, title: string) =>
  squash(typed) === squash(title);
