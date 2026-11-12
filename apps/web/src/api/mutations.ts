import type { Locale } from '@film-routes/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { applyPatch, type RoutePatch } from '../editor/model.js';
import { api } from './instance.js';
import { myRouteQuery } from './queries.js';
import type { AuthorRouteDetail } from './types.js';

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
