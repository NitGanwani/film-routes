import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SEARCH_DELAY_MS, searchTerm } from '../editor/films.js';
import type {
  AuthorRouteDetail,
  AuthorRouteSummary,
  FilmSearchPage,
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

/** One of my routes in full, for the editor. Another person's route answers 404. */
export const myRouteQuery = (routeId: string) => ({
  queryKey: ['my-route', routeId],
  queryFn: () =>
    api
      .request<{ route: AuthorRouteDetail }>(`/routes/${routeId}`, {
        auth: true,
      })
      .then((response) => response.route),
});

export const useMyRoute = (routeId: string) => useQuery(myRouteQuery(routeId));

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

/**
 * Films matching a title, in the language of the interface. The language is part
 * of the key (after the text) because the titles come back in it.
 */
export const filmSearchQuery = (term: string, locale: 'es' | 'en') => ({
  queryKey: ['film-search', term, locale],
  queryFn: () =>
    api.request<FilmSearchPage>(
      `/films/search?q=${encodeURIComponent(term)}&locale=${locale}`,
      { auth: true },
    ),
  // The same words give the same films for a while: typing back is free.
  staleTime: 5 * 60_000,
});

/** A value that follows `value` only after it has stayed the same for `delay` ms. */
export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * The search as it is typed: it asks 300 ms after the last key, and not before
 * there are two letters. `waiting` is true from the first key until the answer
 * is in, so the screen can show it is on its way.
 */
export function useFilmSearch(input: string, locale: 'es' | 'en') {
  const typed = searchTerm(input);
  const settled = useDebounced(typed, SEARCH_DELAY_MS);
  const query = useQuery({
    ...filmSearchQuery(settled ?? '', locale),
    enabled: settled !== null,
  });
  return {
    query,
    /** The text the results on screen belong to; null while there is none. */
    term: settled,
    /** Typed, but the request has not been answered yet. */
    waiting: typed !== null && (typed !== settled || query.isPending),
  };
}
