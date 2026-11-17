import {
  sharedEmotions,
  type Emotion,
  type EnrollmentStatus,
} from '@film-routes/shared';
import type { JourneyStep } from '../api/types.js';

/** One film of the route: what the traveler felt and what the author felt. */
export type FinishPair = {
  position: number;
  mine: Emotion[];
  author: Emotion[];
  /** What they felt in common: they match when it is not empty. */
  shared: Emotion[];
  same: boolean;
};

/** The films side by side, in the route's order. */
export function finishPairs(steps: readonly JourneyStep[]): FinishPair[] {
  return steps.map((step) => {
    const shared = sharedEmotions(step.myEmotions, step.authorEmotions);
    return {
      position: step.position,
      mine: step.myEmotions,
      author: step.authorEmotions,
      shared,
      same: shared.length > 0,
    };
  });
}

/**
 * "You matched on 3 of 4": only the films where both of you chose an emotion
 * can be compared, so a film the author left without one is not counted.
 */
export function finishSummary(pairs: readonly FinishPair[]) {
  const compared = pairs.filter(
    (pair) => pair.mine.length > 0 && pair.author.length > 0,
  );
  return {
    compared: compared.length,
    same: compared.filter((pair) => pair.same).length,
  };
}

/** True only on the answer that turns the route into a completed one. */
export function justCompleted(
  before: EnrollmentStatus | undefined,
  after: EnrollmentStatus,
): boolean {
  return after === 'completed' && before !== 'completed';
}

/** When the strip starts lighting up, and how far apart its frames are (s). */
const STRIP_START = 1.3;
const STRIP_STEP = 0.15;

/** The moment frame `index` of the strip lights up, in seconds. */
export function frameDelay(index: number): number {
  return STRIP_START + STRIP_STEP * index;
}

/**
 * When the parts after the strip come in. They start as the last frame does,
 * so a long route (10 films) waits for its strip instead of covering it.
 */
export function afterStrip(frames: number) {
  const comparison = frameDelay(Math.max(frames, 1) - 1) + STRIP_STEP;
  return {
    comparison,
    match: comparison + 0.05,
    rating: comparison + 0.15,
  };
}

/** Where each of the `count` frames of the strip sits in its 320-wide drawing. */
export function stripFrames(count: number) {
  const margin = 14;
  const gap = 8;
  const width = (320 - margin * 2 - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, index) => ({
    x: margin + index * (width + gap),
    width,
  }));
}
