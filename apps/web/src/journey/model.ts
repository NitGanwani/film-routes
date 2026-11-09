import { ROUTE_LIMITS, type Emotion } from '@film-routes/shared';
import type { CloseStepBody, Film, JourneyStep } from '../api/types.js';

export type StepActions = {
  /** "Start now": remembers it and unlocks the note before. */
  start: boolean;
  /** Close it as watched (it was started). */
  closeWatched: boolean;
  /** Close it straight away because it was already seen before. */
  closeSeen: boolean;
};

const NO_ACTIONS: StepActions = {
  start: false,
  closeWatched: false,
  closeSeen: false,
};

/**
 * What the traveler can do with a film. The order of the route is advice, so
 * every film that is not closed can be started or closed, whatever its place.
 * A traveler who left cannot change anything (the API refuses it as well).
 */
export function stepActions(
  step: Pick<JourneyStep, 'state'>,
  following: boolean,
): StepActions {
  if (!following) return NO_ACTIONS;
  switch (step.state) {
    case 'pending':
      return { start: true, closeWatched: false, closeSeen: true };
    case 'started':
      return { start: false, closeWatched: true, closeSeen: false };
    case 'closed':
      return NO_ACTIONS;
  }
}

/** Whole percent of the films that are closed. */
export function progressPercent(closed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((closed / total) * 100));
}

/** Null until both sides have an emotion to compare. */
export function compareEmotions(
  mine: Emotion | null,
  authors: Emotion | null,
): 'same' | 'different' | null {
  if (!mine || !authors) return null;
  return mine === authors ? 'same' : 'different';
}

export type CloseForm = {
  emotion: Emotion | null;
  comment: string;
  seenBefore: boolean;
};

export type CloseFormProblem = 'emotion_required' | 'comment_too_long';

/** The same two rules the API enforces, so the person hears it before sending. */
export function closeFormProblem(form: CloseForm): CloseFormProblem | null {
  if (!form.emotion) return 'emotion_required';
  if (form.comment.trim().length > ROUTE_LIMITS.commentMaxLength) {
    return 'comment_too_long';
  }
  return null;
}

/** The request body for a valid form. Returns null if the form is not valid. */
export function closeBody(form: CloseForm): CloseStepBody | null {
  if (closeFormProblem(form) !== null || !form.emotion) return null;
  const comment = form.comment.trim();
  return {
    emotion: form.emotion,
    seenBefore: form.seenBefore,
    ...(comment === '' ? {} : { comment }),
  };
}

/** "Perfect Days (2023)"; just the title when the year is unknown. */
export function filmLabel(film: Pick<Film, 'title' | 'releaseYear'>): string {
  return film.releaseYear === null
    ? film.title
    : `${film.title} (${film.releaseYear})`;
}
