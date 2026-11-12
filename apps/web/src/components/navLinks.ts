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
] as const satisfies readonly {
  to: string;
  label: string;
  icon: IconName;
  needsSession: boolean;
}[];
