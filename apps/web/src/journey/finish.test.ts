import { describe, expect, it } from 'vitest';
import type { JourneyStep } from '../api/types.js';
import {
  afterStrip,
  finishPairs,
  finishSummary,
  frameDelay,
  justCompleted,
  stripFrames,
} from './finish.js';

const step = (
  position: number,
  myEmotion: JourneyStep['myEmotion'],
  authorEmotion: JourneyStep['authorEmotion'],
) => ({ position, myEmotion, authorEmotion }) as JourneyStep;

describe('finishPairs and finishSummary', () => {
  it('marks the films where both chose the same emotion', () => {
    const pairs = finishPairs([
      step(1, 'joy', 'joy'),
      step(2, 'awe', 'tenderness'),
      step(3, 'sadness', 'sadness'),
    ]);
    expect(pairs.map((pair) => pair.same)).toEqual([true, false, true]);
    expect(finishSummary(pairs)).toEqual({ compared: 3, same: 2 });
  });

  it('does not count a film the author left without an emotion', () => {
    const pairs = finishPairs([step(1, 'joy', null), step(2, 'joy', 'joy')]);
    expect(pairs[0]?.same).toBe(false);
    expect(finishSummary(pairs)).toEqual({ compared: 1, same: 1 });
  });

  it('has nothing to compare on an empty route', () => {
    expect(finishSummary([])).toEqual({ compared: 0, same: 0 });
  });
});

describe('justCompleted', () => {
  it('is true only when the route turns completed', () => {
    expect(justCompleted('active', 'completed')).toBe(true);
    expect(justCompleted(undefined, 'completed')).toBe(true);
    expect(justCompleted('completed', 'completed')).toBe(false);
    expect(justCompleted('active', 'active')).toBe(false);
  });
});

describe('the timing of the scene', () => {
  it('lights the frames 150 ms apart from 1.3 s', () => {
    expect(frameDelay(0)).toBeCloseTo(1.3);
    expect(frameDelay(3)).toBeCloseTo(1.75);
  });

  it('matches the design for four films and waits longer for ten', () => {
    expect(afterStrip(4).comparison).toBeCloseTo(1.9);
    expect(afterStrip(4).rating).toBeCloseTo(2.05);
    expect(afterStrip(10).comparison).toBeGreaterThan(afterStrip(4).comparison);
  });
});

describe('stripFrames', () => {
  it('fits every count inside the film, without overlapping', () => {
    for (const count of [3, 4, 7, 10]) {
      const frames = stripFrames(count);
      expect(frames).toHaveLength(count);
      expect(frames[0]?.x).toBe(14);
      const last = frames[count - 1]!;
      expect(last.x + last.width).toBeCloseTo(306);
      frames.slice(1).forEach((frame, index) => {
        const before = frames[index]!;
        expect(frame.x).toBeGreaterThan(before.x + before.width);
      });
    }
  });
});
