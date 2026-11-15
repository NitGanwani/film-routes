export const ROUTE_TABS = ['route', 'invites', 'travelers'] as const;
export type RouteTab = (typeof ROUTE_TABS)[number];

/** The address of a tab: the route itself is the first one. */
export const tabPath = (routeId: string, tab: RouteTab) =>
  tab === 'route' ? `/my-routes/${routeId}` : `/my-routes/${routeId}/${tab}`;

/** The page of one traveler, inside the Travelers tab. */
export const travelerPath = (routeId: string, enrollmentId: string) =>
  `/my-routes/${routeId}/travelers/${enrollmentId}`;

const trimmed = (rest: string | undefined) =>
  (rest ?? '').replace(/^\/+|\/+$/g, '');

/** The traveler an address points at (`travelers/:enrollmentId`), or null. */
export function travelerIdFromPath(rest: string | undefined): string | null {
  const match = /^travelers\/([^/]+)$/.exec(trimmed(rest));
  return match?.[1] ?? null;
}

/**
 * The tab an address stands for, from what follows `/my-routes/:id`. The page
 * of a traveler belongs to the Travelers tab. Anything else is not a tab
 * (null), so the page can send it back to the route.
 */
export function tabFromPath(rest: string | undefined): RouteTab | null {
  const name = trimmed(rest);
  if (name === '') return 'route';
  if (travelerIdFromPath(rest) !== null) return 'travelers';
  return (ROUTE_TABS as readonly string[]).includes(name)
    ? (name as RouteTab)
    : null;
}

/** The tab a key moves to (arrows wrap around, Home and End jump), or null for other keys. */
export function tabAfterKey(current: RouteTab, key: string): RouteTab | null {
  const index = ROUTE_TABS.indexOf(current);
  const last = ROUTE_TABS.length - 1;
  switch (key) {
    case 'ArrowRight':
      return ROUTE_TABS[index === last ? 0 : index + 1] ?? null;
    case 'ArrowLeft':
      return ROUTE_TABS[index === 0 ? last : index - 1] ?? null;
    case 'Home':
      return ROUTE_TABS[0];
    case 'End':
      return ROUTE_TABS[last] ?? null;
    default:
      return null;
  }
}
