import type { Emotion } from '@film-routes/shared';
import { describe, expect, it } from 'vitest';
import { isFull, sameEmotions, toggleEmotion } from './emotionPick.js';

describe('toggleEmotion', () => {
  it('adds an emotion, keeping the order they were tapped in', () => {
    expect(toggleEmotion([], 'joy')).toEqual(['joy']);
    expect(toggleEmotion(['joy'], 'awe')).toEqual(['joy', 'awe']);
  });

  it('takes a chosen emotion away, also when there are two', () => {
    expect(toggleEmotion(['joy'], 'joy')).toEqual([]);
    expect(toggleEmotion(['joy', 'awe'], 'joy')).toEqual(['awe']);
  });

  it('does not add a third one', () => {
    expect(toggleEmotion(['joy', 'awe'], 'fear')).toEqual(['joy', 'awe']);
  });

  it('does not change the list it was given', () => {
    const list: Emotion[] = ['joy'];
    toggleEmotion(list, 'awe');
    expect(list).toEqual(['joy']);
  });
});

describe('isFull', () => {
  it('is true from two on', () => {
    expect(isFull([])).toBe(false);
    expect(isFull(['joy'])).toBe(false);
    expect(isFull(['joy', 'awe'])).toBe(true);
  });
});

describe('sameEmotions', () => {
  it('ignores the order', () => {
    expect(sameEmotions(['joy', 'awe'], ['awe', 'joy'])).toBe(true);
  });
  it('tells different ones apart', () => {
    expect(sameEmotions(['joy'], ['awe'])).toBe(false);
    expect(sameEmotions(['joy'], ['joy', 'awe'])).toBe(false);
    expect(sameEmotions([], [])).toBe(true);
  });
});
