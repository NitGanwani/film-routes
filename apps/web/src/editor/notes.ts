import { ROUTE_LIMITS, type Emotion } from '@film-routes/shared';
import type { AuthorStep, JourneyStep } from '../api/types.js';
import { sameEmotions } from '../components/emotionPick.js';
import { measure, type Problem } from './model.js';
import type { SaveState } from './useRouteAutosave.js';

/** What the author is typing for one film, before it is saved. */
export type StepDraft = {
  noteBefore: string;
  noteAfter: string;
  /** The author's own emotions: none = "I do not know yet", at most two. */
  emotions: Emotion[];
};

/** The fields of a film that the author can change (as the API names them). */
export type StepPatch = {
  noteBefore?: string | null;
  noteAfter?: string | null;
  /** The whole list: an empty one takes them away. */
  authorEmotions?: Emotion[];
};

export function draftFromStep(step: AuthorStep): StepDraft {
  return {
    noteBefore: step.noteBefore ?? '',
    noteAfter: step.noteAfter ?? '',
    emotions: step.authorEmotions,
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
  saved: Pick<AuthorStep, 'noteBefore' | 'noteAfter' | 'authorEmotions'>,
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
  if (!sameEmotions(draft.emotions, saved.authorEmotions))
    patch.authorEmotions = draft.emotions;
  return patch;
}

/** What a film says once its draft is applied, for the indicators and the summary. */
export type StepContent = {
  hasBefore: boolean;
  hasAfter: boolean;
  emotions: Emotion[];
};

export function contentOf(
  step: Pick<AuthorStep, 'noteBefore' | 'noteAfter' | 'authorEmotions'>,
  draft?: StepDraft,
): StepContent {
  return draft
    ? {
        hasBefore: keep(draft.noteBefore) !== null,
        hasAfter: keep(draft.noteAfter) !== null,
        emotions: draft.emotions,
      }
    : {
        hasBefore: step.noteBefore !== null,
        hasAfter: step.noteAfter !== null,
        emotions: step.authorEmotions,
      };
}

/**
 * A film is complete with a note before and an emotion. The note after is
 * recommended but not needed, and nothing here keeps a route from being shared.
 */
export const isComplete = (content: StepContent) =>
  content.hasBefore && content.emotions.length > 0;

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
 * The film as the traveler meets it when they have started it: the synopsis
 * is open (it always is), the note after and the author's emotion are not. The real row of the
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
    noteAfter: null,
    noteAfterLocked: true,
    authorEmotions: [],
    seenBefore: false,
    startedAt: null,
    watchedAt: null,
    myEmotions: [],
    myComment: null,
  };
}
