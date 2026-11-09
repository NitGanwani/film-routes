import { ROUTE_LIMITS } from '@film-routes/shared';
import { describe, expect, it } from 'vitest';
import {
  closeBody,
  closeFormProblem,
  compareEmotions,
  filmLabel,
  progressPercent,
  stepActions,
  type CloseForm,
} from './model.js';

describe('stepActions', () => {
  it('lets a pending film be started or closed as already seen', () => {
    expect(stepActions({ state: 'pending' }, true)).toEqual({
      start: true,
      closeWatched: false,
      closeSeen: true,
    });
  });

  it('lets a started film be closed as watched, not started again', () => {
    expect(stepActions({ state: 'started' }, true)).toEqual({
      start: false,
      closeWatched: true,
      closeSeen: false,
    });
  });

  it('offers nothing on a closed film', () => {
    expect(stepActions({ state: 'closed' }, true)).toEqual({
      start: false,
      closeWatched: false,
      closeSeen: false,
    });
  });

  it('offers nothing to someone who left the route', () => {
    for (const state of ['pending', 'started', 'closed'] as const) {
      expect(stepActions({ state }, false)).toEqual({
        start: false,
        closeWatched: false,
        closeSeen: false,
      });
    }
  });
});

describe('progressPercent', () => {
  it('rounds to whole percent', () => {
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(2, 3)).toBe(67);
  });

  it('covers the ends', () => {
    expect(progressPercent(0, 5)).toBe(0);
    expect(progressPercent(5, 5)).toBe(100);
  });

  it('is zero when there are no films, not NaN', () => {
    expect(progressPercent(0, 0)).toBe(0);
  });

  it('never goes past 100', () => {
    expect(progressPercent(7, 5)).toBe(100);
  });
});

describe('compareEmotions', () => {
  it('says same or different when both sides have an emotion', () => {
    expect(compareEmotions('joy', 'joy')).toBe('same');
    expect(compareEmotions('joy', 'fear')).toBe('different');
  });

  it('says nothing while one side is missing', () => {
    expect(compareEmotions(null, 'joy')).toBeNull();
    expect(compareEmotions('joy', null)).toBeNull();
    expect(compareEmotions(null, null)).toBeNull();
  });
});

describe('closing a film', () => {
  const form = (overrides: Partial<CloseForm> = {}): CloseForm => ({
    emotion: 'awe',
    comment: '',
    seenBefore: false,
    ...overrides,
  });

  it('needs an emotion, even for a film already seen', () => {
    expect(closeFormProblem(form({ emotion: null }))).toBe('emotion_required');
    expect(closeFormProblem(form({ emotion: null, seenBefore: true }))).toBe(
      'emotion_required',
    );
    expect(closeBody(form({ emotion: null }))).toBeNull();
  });

  it('accepts a comment of exactly the maximum length', () => {
    const comment = 'a'.repeat(ROUTE_LIMITS.commentMaxLength);
    expect(closeFormProblem(form({ comment }))).toBeNull();
  });

  it('rejects a comment one character over the maximum', () => {
    const comment = 'a'.repeat(ROUTE_LIMITS.commentMaxLength + 1);
    expect(closeFormProblem(form({ comment }))).toBe('comment_too_long');
    expect(closeBody(form({ comment }))).toBeNull();
  });

  it('counts the comment like the API does: after trimming', () => {
    const padded = ` ${'a'.repeat(ROUTE_LIMITS.commentMaxLength)} `;
    expect(closeFormProblem(form({ comment: padded }))).toBeNull();
  });

  it('sends the trimmed comment', () => {
    expect(closeBody(form({ comment: '  qué final  ' }))).toEqual({
      emotion: 'awe',
      seenBefore: false,
      comment: 'qué final',
    });
  });

  it('leaves the comment out when it is empty or only spaces', () => {
    expect(closeBody(form({ comment: '' }))).toEqual({
      emotion: 'awe',
      seenBefore: false,
    });
    expect(closeBody(form({ comment: '   ' }))).not.toHaveProperty('comment');
  });

  it('passes on whether the film was seen before', () => {
    expect(closeBody(form({ seenBefore: true }))?.seenBefore).toBe(true);
    expect(closeBody(form({ seenBefore: false }))?.seenBefore).toBe(false);
  });
});

describe('filmLabel', () => {
  it('adds the year when known', () => {
    expect(filmLabel({ title: 'Perfect Days', releaseYear: 2023 })).toBe(
      'Perfect Days (2023)',
    );
  });

  it('is just the title when the year is unknown', () => {
    expect(filmLabel({ title: 'Perfect Days', releaseYear: null })).toBe(
      'Perfect Days',
    );
  });
});
