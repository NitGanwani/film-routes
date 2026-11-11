import type { Journey, PublicRouteDetail } from './types.js';
import { api } from './instance.js';

/**
 * The queries of the two pages a route card opens, in one place so the page and
 * the card (which loads them a moment early) always ask the same thing under
 * the same key.
 */
export const publicRouteQuery = (routeId: string) => ({
  queryKey: ['public-route', routeId],
  queryFn: () =>
    api
      .request<{ route: PublicRouteDetail }>(`/public/routes/${routeId}`)
      .then((response) => response.route),
});

export const journeyQuery = (routeId: string) => ({
  queryKey: ['journey', routeId],
  queryFn: () =>
    api
      .request<{ journey: Journey }>(`/routes/${routeId}/journey`, {
        auth: true,
      })
      .then((response) => response.journey),
});
