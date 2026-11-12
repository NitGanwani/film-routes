import { ROUTE_LIMITS } from '@film-routes/shared';
import { describe, expect, it } from 'vitest';
import type { AuthorStep } from '../api/types.js';
import { stepFromResult } from './films.js';
import {
  combineSaveState,
  contentOf,
  draftFromStep,
  isComplete,
  noteProblem,
  notesProgress,
  previewStep,
  stepPatch,
} from './notes.js';

const step = (change: Partial<AuthorStep> = {}): AuthorStep => ({
  ...stepFromResult(
    {
      tmdbId: 1,
      title: 'Big Fish',
      originalTitle: 'Big Fish',
      releaseYear: 2003,
      posterUrl: null,
      posterUrlSmall: null,
      backdropUrl: null,
    },
    1,
  ),
  id: 'step-1',
  ...change,
});

describe('draftFromStep', () => {
  it('starts from what is saved, with empty text for no note', () => {
    expect(draftFromStep(step())).toEqual({
      noteBefore: '',
      noteAfter: '',
      emotion: null,
    });
    expect(
      draftFromStep(
        step({ noteBefore: 'Mira el árbol', authorEmotion: 'awe' }),
      ),
    ).toEqual({ noteBefore: 'Mira el árbol', noteAfter: '', emotion: 'awe' });
  });
});

describe('noteProblem', () => {
  it('allows an empty note and one up to the limit', () => {
    expect(noteProblem('')).toBeNull();
    expect(noteProblem('a'.repeat(ROUTE_LIMITS.noteMaxLength))).toBeNull();
  });

  it('refuses one past the limit, not counting the spaces around it', () => {
    expect(noteProblem('a'.repeat(ROUTE_LIMITS.noteMaxLength + 1))).toBe(
      'tooLong',
    );
    expect(
      noteProblem(`  ${'a'.repeat(ROUTE_LIMITS.noteMaxLength)}  `),
    ).toBeNull();
  });
});

describe('stepPatch', () => {
  const saved = step({
    noteBefore: 'Antes',
    noteAfter: null,
    authorEmotion: 'joy',
  });

  it('is empty when nothing changed', () => {
    expect(stepPatch(saved, draftFromStep(saved))).toEqual({});
  });

  it('sends only what changed', () => {
    expect(
      stepPatch(saved, {
        noteBefore: 'Antes',
        noteAfter: 'Final',
        emotion: 'joy',
      }),
    ).toEqual({ noteAfter: 'Final' });
    expect(
      stepPatch(saved, { noteBefore: 'Antes', noteAfter: '', emotion: 'fear' }),
    ).toEqual({ authorEmotion: 'fear' });
  });

  it('ignores the spaces around a note, as the API does', () => {
    expect(
      stepPatch(saved, {
        noteBefore: '  Antes  ',
        noteAfter: '',
        emotion: 'joy',
      }),
    ).toEqual({});
  });

  it('clears a note that was emptied, and an emotion that is "not known yet"', () => {
    expect(
      stepPatch(saved, { noteBefore: '   ', noteAfter: '', emotion: null }),
    ).toEqual({ noteBefore: null, authorEmotion: null });
  });

  it('holds back a note that is too long without stopping the rest', () => {
    const tooLong = 'a'.repeat(ROUTE_LIMITS.noteMaxLength + 1);
    expect(
      stepPatch(saved, {
        noteBefore: tooLong,
        noteAfter: 'Final',
        emotion: 'awe',
      }),
    ).toEqual({ noteAfter: 'Final', authorEmotion: 'awe' });
  });
});

describe('contentOf and completeness', () => {
  it('reads the saved film when there is no draft', () => {
    expect(contentOf(step({ noteBefore: 'x', authorEmotion: 'joy' }))).toEqual({
      hasBefore: true,
      hasAfter: false,
      emotion: 'joy',
    });
  });

  it('prefers what is being typed, and an empty note counts as none', () => {
    const saved = step({ noteBefore: 'x' });
    expect(
      contentOf(saved, { noteBefore: '  ', noteAfter: 'y', emotion: null }),
    ).toEqual({ hasBefore: false, hasAfter: true, emotion: null });
  });

  it('is complete with a note before and an emotion; the note after is optional', () => {
    expect(
      isComplete({ hasBefore: true, hasAfter: false, emotion: 'joy' }),
    ).toBe(true);
    expect(isComplete({ hasBefore: true, hasAfter: true, emotion: null })).toBe(
      false,
    );
    expect(
      isComplete({ hasBefore: false, hasAfter: true, emotion: 'joy' }),
    ).toBe(false);
  });

  it('counts the complete films', () => {
    expect(
      notesProgress([
        { hasBefore: true, hasAfter: false, emotion: 'joy' },
        { hasBefore: true, hasAfter: true, emotion: null },
        { hasBefore: true, hasAfter: true, emotion: 'awe' },
      ]),
    ).toEqual({ done: 2, total: 3 });
    expect(notesProgress([])).toEqual({ done: 0, total: 0 });
  });
});

describe('combineSaveState', () => {
  it('shows a failure first, then a save in progress, else saved', () => {
    expect(combineSaveState('saved', 'saved')).toBe('saved');
    expect(combineSaveState('saved', 'saving')).toBe('saving');
    expect(combineSaveState('failed', 'saving')).toBe('failed');
  });
});

describe('previewStep', () => {
  it('opens the note before, locks the note after and hides the author emotion', () => {
    const preview = previewStep(
      step({ noteAfter: 'El final', authorEmotion: 'tension' }),
      { noteBefore: ' Mira el árbol ' },
    );
    expect(preview).toMatchObject({
      state: 'started',
      noteBefore: 'Mira el árbol',
      noteBeforeLocked: false,
      noteAfter: null,
      noteAfterLocked: true,
      authorEmotion: null,
    });
  });

  it('keeps the film and its position', () => {
    const preview = previewStep(step(), { noteBefore: '' });
    expect(preview.film.tmdbId).toBe(1);
    expect(preview.position).toBe(1);
    expect(preview.noteBefore).toBeNull();
  });
});
