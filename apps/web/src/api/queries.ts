import { useQuery } from '@tanstack/react-query';
import type {
  AuthorRouteSummary,
  Journey,
  PublicRouteDetail,
  PublicRoutesPage,
} from './types.js';
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

/** The routes the signed-in person has written, most recently changed first. */
export const myRoutesQuery = () => ({
  queryKey: ['my-routes'],
  queryFn: () =>
    api
      .request<{ routes: AuthorRouteSummary[] }>('/routes', { auth: true })
      .then((response) => response.routes),
});

export const useMyRoutes = () => useQuery(myRoutesQuery());

/**
 * The public routes in one order. `locale` null = every language. The key keeps
 * the shape Explore has always used, so the landing page and Explore share it.
 */
export const publicRoutesQuery = (
  sort: 'new' | 'popular' | 'top',
  locale: 'es' | 'en' | null,
) => ({
  queryKey: ['public-routes', sort, locale ?? 'all'],
  queryFn: () =>
    api.request<PublicRoutesPage>(
      `/public/routes?sort=${sort}${locale ? `&locale=${locale}` : ''}`,
    ),
});
