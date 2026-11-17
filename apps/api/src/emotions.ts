import {
  EMOTIONS,
  MAX_EMOTIONS,
  sharedEmotions,
  type Emotion,
} from '@film-routes/shared';
import { z } from 'zod';
import type { Emotion as DbEmotion } from '../generated/prisma/enums.js';

/**
 * A list of feelings: from `min` to MAX_EMOTIONS, none repeated. The order is
 * the one the person chose; it is kept, but it means nothing.
 */
export const emotionList = (min: 0 | 1) =>
  z
    .array(z.enum(EMOTIONS))
    .min(min)
    .max(MAX_EMOTIONS)
    .refine((list) => new Set(list).size === list.length, {
      message: 'An emotion cannot be repeated',
    });

/**
 * The two columns that hold a film's feelings. `second` can only exist with a
 * `first` and must differ from it: the database checks it too.
 */
export type EmotionColumns = {
  first: DbEmotion | null;
  second: DbEmotion | null;
};

export function toColumns(emotions: readonly Emotion[]): EmotionColumns {
  const upper = (emotion: Emotion | undefined) =>
    (emotion?.toUpperCase() as DbEmotion | undefined) ?? null;
  return { first: upper(emotions[0]), second: upper(emotions[1]) };
}

export function fromColumns(
  first: DbEmotion | null,
  second: DbEmotion | null,
): Emotion[] {
  return [first, second]
    .filter((emotion): emotion is DbEmotion => emotion !== null)
    .map((emotion) => emotion.toLowerCase() as Emotion);
}

/**
 * What two people felt in common; null until both have felt something, because
 * there is nothing to compare before that.
 */
export function sharedOrNull(
  a: readonly Emotion[],
  b: readonly Emotion[],
): Emotion[] | null {
  return a.length > 0 && b.length > 0 ? sharedEmotions(a, b) : null;
}
