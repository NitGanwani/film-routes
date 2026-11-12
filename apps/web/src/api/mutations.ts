import type { Locale } from '@film-routes/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  isLockedRefusal,
  withStepAdded,
  withStepRemoved,
  withStepsOrdered,
  withStepUpdated,
} from '../editor/films.js';
import { applyPatch, type RoutePatch } from '../editor/model.js';
import type { StepPatch } from '../editor/notes.js';
import { api } from './instance.js';
import { myRouteQuery } from './queries.js';
import type { AuthorRouteDetail, FilmSearchResult } from './types.js';

/**
 * Save the title or the description of one of my routes. The page changes
 * first (so nothing flickers) and goes back if the server says no; either way
 * the list of my routes is asked again, since it shows the title.
 */
export function useUpdateRoute(routeId: string) {
  const queryClient = useQueryClient();
  const key = myRouteQuery(routeId).queryKey;
  return useMutation({
    mutationFn: (patch: RoutePatch) =>
      api
        .request<{ route: AuthorRouteDetail }>(`/routes/${routeId}`, {
          method: 'PATCH',
          auth: true,
          body: patch,
        })
        .then((response) => response.route),
    onMutate: async (patch) => {
      // A load that lands now would paint over the change.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AuthorRouteDetail>(key);
      if (previous) queryClient.setQueryData(key, applyPatch(previous, patch));
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (route) => queryClient.setQueryData(key, route),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['my-routes'] }),
  });
}

/** Start a route: a title and the language it is written in. Then on to its editor. */
export function useCreateRoute() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (input: { title: string; locale: Locale }) =>
      api
        .request<{ route: AuthorRouteDetail }>('/routes', {
          method: 'POST',
          auth: true,
          body: input,
        })
        .then((response) => response.route),
    onSuccess: (route) => {
      // The editor opens with the route already in hand: no second load.
      queryClient.setQueryData(myRouteQuery(route.id).queryKey, route);
      void queryClient.invalidateQueries({ queryKey: ['my-routes'] });
      void navigate(`/my-routes/${route.id}`, { replace: true });
    },
  });
}

/** Marks the changes to the list of films, so the hooks below can tell how many are in flight. */
const stepsKey = (routeId: string) => ['route-steps', routeId] as const;

/**
 * The three ways to change the films of a route. Each one shows its result at
 * once and goes back if the server refuses.
 *
 * Several can be in flight together (two quick adds, an add and a move). Then:
 *  - an answer is only used when it is the only one pending, so it cannot wipe
 *    the change that is still on its way;
 *  - a rollback also waits for that, and the last one to land reads the route
 *    again, so the screen always ends up showing what the server has.
 * A refusal because travelers have joined reads the route again too: it is now
 * locked, and the editor shows it.
 */
export function useRouteFilms(routeId: string) {
  const queryClient = useQueryClient();
  const key = myRouteQuery(routeId).queryKey;
  const mutationKey = stepsKey(routeId);

  const alone = () => queryClient.isMutating({ mutationKey }) <= 1;
  // A change that failed while others were in flight could not be undone on
  // its own: the last one to land reads the route to put things right.
  const unsettled = useRef(false);

  /** Shared by the three: show first, undo on error, settle at the end. */
  const callbacks = <V>(
    show: (route: AuthorRouteDetail, input: V) => AuthorRouteDetail,
    // Reading the route again after a success is only worth it when the answer
    // is not the whole route (every one of these answers with it): kept for a
    // refusal, where it tells what the server really has.
    options: { verify?: boolean } = { verify: true },
  ) => ({
    mutationKey,
    onMutate: async (input: V) => {
      // A load that lands now would paint over the change.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AuthorRouteDetail>(key);
      if (previous) queryClient.setQueryData(key, show(previous, input));
      return { previous };
    },
    onError: (
      error: unknown,
      _input: V,
      context: { previous: AuthorRouteDetail | undefined } | undefined,
    ) => {
      if (context?.previous && alone()) {
        queryClient.setQueryData(key, context.previous);
      } else {
        unsettled.current = true;
      }
      if (isLockedRefusal(error)) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onSuccess: (route: AuthorRouteDetail) => {
      if (alone()) queryClient.setQueryData(key, route);
    },
    onSettled: (_route: unknown, error: unknown) => {
      void queryClient.invalidateQueries({ queryKey: ['my-routes'] });
      if (alone() && (error || options.verify || unsettled.current)) {
        unsettled.current = false;
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  const add = useMutation({
    mutationFn: (result: FilmSearchResult) =>
      api
        .request<{ route: AuthorRouteDetail }>(`/routes/${routeId}/steps`, {
          method: 'POST',
          auth: true,
          body: { tmdbId: result.tmdbId },
        })
        .then((response) => response.route),
    ...callbacks<FilmSearchResult>(withStepAdded),
  });

  const remove = useMutation({
    mutationFn: (stepId: string) =>
      api
        .request<{ route: AuthorRouteDetail }>(
          `/routes/${routeId}/steps/${stepId}`,
          { method: 'DELETE', auth: true },
        )
        .then((response) => response.route),
    ...callbacks<string>(withStepRemoved),
  });

  const reorder = useMutation({
    mutationFn: (stepIds: string[]) =>
      api
        .request<{ route: AuthorRouteDetail }>(
          `/routes/${routeId}/steps/order`,
          { method: 'PUT', auth: true, body: { stepIds } },
        )
        .then((response) => response.route),
    ...callbacks<string[]>(withStepsOrdered),
  });

  // Notes and emotion: allowed even when travelers have joined, so no lock to
  // react to. Saving text is frequent, so success does not read the route again.
  const update = useMutation({
    mutationFn: (change: { stepId: string; patch: StepPatch }) =>
      api
        .request<{ route: AuthorRouteDetail }>(
          `/routes/${routeId}/steps/${change.stepId}`,
          { method: 'PATCH', auth: true, body: change.patch },
        )
        .then((response) => response.route),
    ...callbacks<{ stepId: string; patch: StepPatch }>(withStepUpdated, {
      verify: false,
    }),
  });

  return { add, remove, reorder, update };
}
