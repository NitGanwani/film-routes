import { ROUTE_LIMITS } from '@film-routes/shared';
import { describe, expect, it } from 'vitest';
import {
  closeBody,
  closeFormProblem,
  compareEmotions,
  comparisonOf,
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
  it('matches when they share at least one emotion, and says which', () => {
    expect(compareEmotions(['joy'], ['joy'])).toEqual({
      result: 'same',
      shared: ['joy'],
    });
    expect(compareEmotions(['joy', 'awe'], ['fear', 'awe'])).toEqual({
      result: 'same',
      shared: ['awe'],
    });
    expect(compareEmotions(['joy', 'awe'], ['awe', 'joy'])).toEqual({
      result: 'same',
      shared: ['joy', 'awe'],
    });
  });

  it('is different when they share none', () => {
    expect(compareEmotions(['joy'], ['fear'])).toEqual({
      result: 'different',
      shared: [],
    });
    expect(compareEmotions(['joy', 'awe'], ['fear', 'sadness'])).toEqual({
      result: 'different',
      shared: [],
    });
  });

  it('says nothing while one side is missing', () => {
    expect(compareEmotions([], ['joy'])).toBeNull();
    expect(compareEmotions(['joy'], [])).toBeNull();
    expect(compareEmotions([], [])).toBeNull();
  });
});

describe('comparisonOf', () => {
  it('takes what the API worked out', () => {
    expect(comparisonOf(null)).toBeNull();
    expect(comparisonOf([])).toEqual({ result: 'different', shared: [] });
    expect(comparisonOf(['awe'])).toEqual({ result: 'same', shared: ['awe'] });
  });
});

describe('closing a film', () => {
  const form = (overrides: Partial<CloseForm> = {}): CloseForm => ({
    emotions: ['awe'],
    comment: '',
    seenBefore: false,
    ...overrides,
  });

  it('needs an emotion, even for a film already seen', () => {
    expect(closeFormProblem(form({ emotions: [] }))).toBe('emotion_required');
    expect(closeFormProblem(form({ emotions: [], seenBefore: true }))).toBe(
      'emotion_required',
    );
    expect(closeBody(form({ emotions: [] }))).toBeNull();
  });

  it('accepts one or two emotions and sends them in order', () => {
    expect(closeFormProblem(form({ emotions: ['joy', 'awe'] }))).toBeNull();
    expect(closeBody(form({ emotions: ['joy', 'awe'] }))?.emotions).toEqual([
      'joy',
      'awe',
    ]);
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
      emotions: ['awe'],
      seenBefore: false,
      comment: 'qué final',
    });
  });

  it('leaves the comment out when it is empty or only spaces', () => {
    expect(closeBody(form({ comment: '' }))).toEqual({
      emotions: ['awe'],
      seenBefore: false,
    });
    expect(closeBody(form({ comment: '   ' }))).not.toHaveProperty('comment');
  });

  it('passes on whether the film was seen before', () => {
    expect(closeBody(form({ seenBefore: true }))?.seenBefore).toBe(true);
    expect(closeBody(form({ seenBefore: false }))?.seenBefore).toBe(false);
  });
});
