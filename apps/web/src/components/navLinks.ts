import type { IconName } from './Icon.js';

/**
 * The main links, written once for the top bar (wide screens) and the bottom bar
 * (phones). Anonymous visitors only see the ones that do not need an account.
 */
export const NAV_LINKS = [
  {
    to: '/explore',
    label: 'nav.explore',
    icon: 'compass',
    needsSession: false,
  },
  {
    to: '/journeys',
    label: 'nav.journeys',
    icon: 'journey',
    needsSession: true,
  },
  {
    to: '/my-routes',
    label: 'nav.myRoutes',
    icon: 'pencil',
    needsSession: true,
  },
  {
    to: '/admin/reports',
    label: 'nav.moderation',
    icon: 'flag',
    needsSession: true,
    needsAdmin: true,
  },
] as const satisfies readonly {
  to: string;
  label: string;
  icon: IconName;
  needsSession: boolean;
  /** Only moderators see it. */
  needsAdmin?: boolean;
}[];

/** The links this person gets: anonymous visitors, members and moderators see different ones. */
export function visibleLinks(user: { isAdmin: boolean } | null) {
  return NAV_LINKS.filter(
    (link) =>
      (user !== null || !link.needsSession) &&
      (!('needsAdmin' in link) || user?.isAdmin === true),
  );
}
