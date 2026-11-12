import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUpdateRoute } from '../api/mutations.js';
import { myRouteQuery } from '../api/queries.js';
import type { AuthorRouteDetail } from '../api/types.js';
import { AUTOSAVE_DELAY_MS, routePatch, type Draft } from './model.js';

export type SaveState = 'saved' | 'saving' | 'failed';

/**
 * The editor's title and description, saved by themselves: when a field loses
 * focus, or 800 ms after the last key, whichever comes first. There is no save
 * button, so nothing can be forgotten.
 *
 *  - Only what changed is sent, and a field with a problem is held back.
 *  - One request at a time: a save asked for while another is in flight waits
 *    for it and then goes with everything that is new, so a failure can never
 *    swallow a later change.
 *  - A save that fails shows "Retry"; retrying works out what is still unsaved
 *    again, so it does not repeat a stale request.
 *  - Leaving the page saves what is pending.
 *
 * The text lives here (not in the cache) so typing never fights with a reload.
 */
export function useRouteAutosave(route: AuthorRouteDetail) {
  const queryClient = useQueryClient();
  const { mutateAsync, reset, isPending, isError } = useUpdateRoute(route.id);
  const [title, setTitleValue] = useState(route.title);
  const [description, setDescriptionValue] = useState(route.description ?? '');
  const draft = useRef<Draft>({
    title: route.title,
    description: route.description ?? '',
  });
  // The route as it first arrived. Kept in a ref so a fresher copy coming back from
  // the server does not change `flush` (and with it, trigger the save-on-leave).
  const initial = useRef(route);
  const routeId = route.id;
  const timer = useRef<number | undefined>(undefined);
  const running = useRef(false);
  const again = useRef(false);

  const flush = useCallback(
    function run() {
      window.clearTimeout(timer.current);
      if (running.current) {
        again.current = true;
        return;
      }
      // What the server has (or is about to have): the cache, kept by the mutation.
      const saved =
        queryClient.getQueryData<AuthorRouteDetail>(
          myRouteQuery(routeId).queryKey,
        ) ?? initial.current;
      const patch = routePatch(saved, draft.current);
      if (Object.keys(patch).length === 0) {
        // Nothing to save, so a "could not save" that is left over is no longer true.
        reset();
        return;
      }
      running.current = true;
      mutateAsync(patch)
        .catch(() => undefined) // the failure shows in the indicator
        .finally(() => {
          running.current = false;
          if (again.current) {
            again.current = false;
            run();
          }
        });
    },
    [queryClient, routeId, mutateAsync, reset],
  );

  const schedule = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, AUTOSAVE_DELAY_MS);
  };

  // Going to another page with something typed in the last moments.
  useEffect(() => () => flush(), [flush]);

  return {
    title,
    description,
    setTitle: (value: string) => {
      setTitleValue(value);
      draft.current.title = value;
      schedule();
    },
    setDescription: (value: string) => {
      setDescriptionValue(value);
      draft.current.description = value;
      schedule();
    },
    /** Save now: a field lost focus, or "Retry" was pressed. */
    flush,
    state: (isPending ? 'saving' : isError ? 'failed' : 'saved') as SaveState,
  };
}
