import { ROUTE_LIMITS, type Emotion } from '@film-routes/shared';
import type { AuthorStep, JourneyStep } from '../api/types.js';
import { measure, type Problem } from './model.js';
import type { SaveState } from './useRouteAutosave.js';

/** What the author is typing for one film, before it is saved. */
export type StepDraft = {
  noteBefore: string;
  noteAfter: string;
  /** The author's own emotion; null = "I do not know yet". */
  emotion: Emotion | null;
};

/** The fields of a film that the author can change (as the API names them). */
export type StepPatch = {
  noteBefore?: string | null;
  noteAfter?: string | null;
  authorEmotion?: Emotion | null;
};

export function draftFromStep(step: AuthorStep): StepDraft {
  return {
    noteBefore: step.noteBefore ?? '',
    noteAfter: step.noteAfter ?? '',
    emotion: step.authorEmotion,
  };
}

/** A note may be empty; too long is the only way for it to be wrong. */
export function noteProblem(value: string): Problem | null {
  return measure(value) > ROUTE_LIMITS.noteMaxLength ? 'tooLong' : null;
}

/** What the API keeps of a note: the text without the spaces around it, or nothing. */
const keep = (value: string) => value.trim() || null;

/**
 * What to send for one film: only what changed. A note with a problem is held
 * back (the message under it says why) without stopping the other fields.
 */
export function stepPatch(
  saved: Pick<AuthorStep, 'noteBefore' | 'noteAfter' | 'authorEmotion'>,
  draft: StepDraft,
): StepPatch {
  const patch: StepPatch = {};
  if (noteProblem(draft.noteBefore) === null) {
    const next = keep(draft.noteBefore);
    if (next !== saved.noteBefore) patch.noteBefore = next;
  }
  if (noteProblem(draft.noteAfter) === null) {
    const next = keep(draft.noteAfter);
    if (next !== saved.noteAfter) patch.noteAfter = next;
  }
  if (draft.emotion !== saved.authorEmotion)
    patch.authorEmotion = draft.emotion;
  return patch;
}

/** What a film says once its draft is applied, for the indicators and the summary. */
export type StepContent = {
  hasBefore: boolean;
  hasAfter: boolean;
  emotion: Emotion | null;
};

export function contentOf(
  step: Pick<AuthorStep, 'noteBefore' | 'noteAfter' | 'authorEmotion'>,
  draft?: StepDraft,
): StepContent {
  return draft
    ? {
        hasBefore: keep(draft.noteBefore) !== null,
        hasAfter: keep(draft.noteAfter) !== null,
        emotion: draft.emotion,
      }
    : {
        hasBefore: step.noteBefore !== null,
        hasAfter: step.noteAfter !== null,
        emotion: step.authorEmotion,
      };
}

/**
 * A film is complete with a note before and an emotion. The note after is
 * recommended but not needed, and nothing here keeps a route from being shared.
 */
export const isComplete = (content: StepContent) =>
  content.hasBefore && content.emotion !== null;

export function notesProgress(contents: StepContent[]) {
  return { done: contents.filter(isComplete).length, total: contents.length };
}

/** The indicator of the page: failed beats saving beats saved. */
export function combineSaveState(...states: SaveState[]): SaveState {
  if (states.includes('failed')) return 'failed';
  if (states.includes('saving')) return 'saving';
  return 'saved';
}

/**
 * The film as the traveler meets it when they have started it: the note before
 * is open, the note after and the author's emotion are not. The real row of the
 * journey draws it, so the preview can never drift from what they will see.
 */
export function previewStep(
  step: AuthorStep,
  content: { noteBefore: string },
): JourneyStep {
  return {
    id: step.id,
    position: step.position,
    film: step.film,
    state: 'started',
    recommendedNext: false,
    noteBefore: keep(content.noteBefore),
    noteBeforeLocked: false,
    noteAfter: null,
    noteAfterLocked: true,
    authorEmotion: null,
    seenBefore: false,
    startedAt: null,
    watchedAt: null,
    myEmotion: null,
    myComment: null,
  };
}
