import type { Emotion } from '@film-routes/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { useRouteFilms } from '../api/mutations.js';
import { myRouteQuery } from '../api/queries.js';
import type { AuthorRouteDetail, AuthorStep } from '../api/types.js';
import { isPendingStep, stepKey } from './films.js';
import { AUTOSAVE_DELAY_MS } from './model.js';
import { draftFromStep, stepPatch, type StepDraft } from './notes.js';
import type { SaveState } from './useRouteAutosave.js';

export type NoteField = 'noteBefore' | 'noteAfter';

/** A film that is still being saved has no id of its own yet: look again soon. */
const PENDING_RETRY_MS = 300;

/**
 * The notes and the emotion of every film, saved by themselves, the same way
 * as the title and the description: a note when its field loses focus or 800 ms
 * after the last key; an emotion the moment it is chosen.
 *
 *  - The text lives here (not in the cache), so typing never fights a reload.
 *  - Only what changed is sent, and a note with a problem is held back.
 *  - One request per film at a time: a save asked for while another is in flight
 *    waits and then goes with everything new, so a failure cannot swallow a
 *    later change.
 *  - A film whose save failed stays "failed" until a save of it goes through;
 *    "Retry" works out what is still unsaved again.
 *  - Leaving the page saves what is pending.
 *
 * Films are told apart by their TMDB id, which does not change when a film just
 * added gets its real id from the server.
 */
export function useStepNotes(
  routeId: string,
  update: ReturnType<typeof useRouteFilms>['update'],
) {
  const queryClient = useQueryClient();
  const drafts = useRef(new Map<string, StepDraft>());
  const timers = useRef(new Map<string, number>());
  const running = useRef(new Set<string>());
  const again = useRef(new Set<string>());
  const [, rerender] = useState(0);
  const [saving, setSaving] = useState(0);
  const [failed, setFailed] = useState<readonly string[]>([]);
  const updateRef = useRef(update.mutateAsync);
  updateRef.current = update.mutateAsync;

  const draftOf = (step: AuthorStep): StepDraft => {
    const key = stepKey(step);
    let draft = drafts.current.get(key);
    if (!draft) {
      draft = draftFromStep(step);
      drafts.current.set(key, draft);
    }
    return draft;
  };

  const flushKey = useCallback(
    function run(key: string) {
      window.clearTimeout(timers.current.get(key));
      timers.current.delete(key);
      if (running.current.has(key)) {
        again.current.add(key);
        return;
      }
      const draft = drafts.current.get(key);
      const step = queryClient
        .getQueryData<AuthorRouteDetail>(myRouteQuery(routeId).queryKey)
        ?.steps.find((candidate) => stepKey(candidate) === key);
      if (!draft || !step) return;
      if (isPendingStep(step)) {
        timers.current.set(
          key,
          window.setTimeout(() => run(key), PENDING_RETRY_MS),
        );
        return;
      }
      const patch = stepPatch(step, draft);
      if (Object.keys(patch).length === 0) {
        // Nothing to save, so a "could not save" left over is no longer true.
        setFailed((current) => current.filter((item) => item !== key));
        return;
      }
      running.current.add(key);
      setSaving((count) => count + 1);
      updateRef
        .current({ stepId: step.id, patch })
        .then(() => setFailed((current) => current.filter((i) => i !== key)))
        .catch(() =>
          setFailed((current) =>
            current.includes(key) ? current : [...current, key],
          ),
        )
        .finally(() => {
          running.current.delete(key);
          setSaving((count) => count - 1);
          if (again.current.delete(key)) run(key);
        });
    },
    [queryClient, routeId],
  );

  const flushAll = useCallback(() => {
    for (const key of drafts.current.keys()) flushKey(key);
  }, [flushKey]);

  const schedule = (key: string) => {
    window.clearTimeout(timers.current.get(key));
    timers.current.set(
      key,
      window.setTimeout(() => flushKey(key), AUTOSAVE_DELAY_MS),
    );
  };

  /** Forget the films that are gone: a removed film must not be saved back. */
  const forget = useCallback((steps: AuthorStep[]) => {
    const present = new Set(steps.map(stepKey));
    for (const key of [...drafts.current.keys()]) {
      if (present.has(key)) continue;
      window.clearTimeout(timers.current.get(key));
      timers.current.delete(key);
      drafts.current.delete(key);
      setFailed((current) => current.filter((item) => item !== key));
    }
  }, []);

  // Going to another page with something typed in the last moments.
  useEffect(() => flushAll, [flushAll]);

  const state: SaveState =
    failed.length > 0 ? 'failed' : saving > 0 ? 'saving' : 'saved';

  return {
    /** The draft of a film: what to show in its fields. */
    draft: draftOf,
    forget,
    setNote(step: AuthorStep, field: NoteField, value: string) {
      draftOf(step)[field] = value;
      rerender((n) => n + 1);
      schedule(stepKey(step));
    },
    setEmotion(step: AuthorStep, emotion: Emotion | null) {
      draftOf(step).emotion = emotion;
      rerender((n) => n + 1);
      flushKey(stepKey(step));
    },
    /** Save one film now: one of its notes lost focus. */
    flush: (step: AuthorStep) => flushKey(stepKey(step)),
    /** Save everything now: "Retry" was pressed. */
    flushAll,
    state,
  };
}
