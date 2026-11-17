import { MAX_EMOTIONS, type Emotion } from '@film-routes/shared';

/**
 * Taps on an emotion: a chosen one is taken away; a new one is added while
 * there is room, and ignored once there are two (the picker disables the rest
 * and says why, so a tap that does nothing should not happen).
 */
export function toggleEmotion(
  list: readonly Emotion[],
  emotion: Emotion,
): Emotion[] {
  if (list.includes(emotion)) return list.filter((item) => item !== emotion);
  return list.length < MAX_EMOTIONS ? [...list, emotion] : [...list];
}

/** True when no more can be added: the unchosen ones are then disabled. */
export const isFull = (list: readonly Emotion[]) => list.length >= MAX_EMOTIONS;

/** The same emotions, whatever the order they were tapped in. */
export function sameEmotions(
  a: readonly Emotion[],
  b: readonly Emotion[],
): boolean {
  return a.length === b.length && a.every((emotion) => b.includes(emotion));
}
