import { describe, expect, it } from 'vitest';
import {
  firstKeyScore,
  frameDelays,
  pageStep,
  ratingView,
  scoreAt,
  UNRATED,
} from './rating.js';

describe('scoreAt', () => {
  it('gives every frame a tenth of the width', () => {
    expect(scoreAt(0, 340)).toBe(1);
    expect(scoreAt(33, 340)).toBe(1);
    expect(scoreAt(34, 340)).toBe(2);
    expect(scoreAt(170, 340)).toBe(6);
    expect(scoreAt(339, 340)).toBe(10);
  });

  it('reaches both ends when the finger leaves the strip', () => {
    expect(scoreAt(-50, 340)).toBe(1);
    expect(scoreAt(900, 340)).toBe(10);
  });

  it('does not break on a strip with no width', () => {
    expect(scoreAt(10, 0)).toBe(1);
  });
});

describe('firstKeyScore', () => {
  it('starts from the first frame for the keys that move', () => {
    for (const key of ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home']) {
      expect(firstKeyScore(key)).toBe(1);
    }
  });

  it('jumps like the native range would from nothing', () => {
    expect(firstKeyScore('End')).toBe(10);
    expect(firstKeyScore('PageUp')).toBe(3);
  });

  it('ignores the rest, so Tab keeps working', () => {
    expect(firstKeyScore('Tab')).toBeNull();
    expect(firstKeyScore('a')).toBeNull();
  });
});

describe('pageStep', () => {
  it('jumps three points at a time', () => {
    expect(pageStep('PageUp', 4)).toBe(7);
    expect(pageStep('PageDown', 8)).toBe(5);
  });

  it('stops at both ends', () => {
    expect(pageStep('PageUp', 9)).toBe(10);
    expect(pageStep('PageDown', 2)).toBe(1);
  });

  it('leaves every other key to the range', () => {
    expect(pageStep('ArrowUp', 4)).toBeNull();
    expect(pageStep('Home', 4)).toBeNull();
  });
});

describe('frameDelays', () => {
  it('lights the new frames one after another', () => {
    const delays = frameDelays(3, 6);
    expect(delays.slice(3, 6)).toEqual([0, 20, 40]);
    expect(delays.slice(0, 3)).toEqual([0, 0, 0]);
    expect(delays.slice(6)).toEqual([0, 0, 0, 0]);
  });

  it('starts from nothing at the first frame', () => {
    expect(frameDelays(UNRATED, 3).slice(0, 3)).toEqual([0, 20, 40]);
  });

  it('puts the frames out from the old top downwards', () => {
    const delays = frameDelays(8, 5);
    // 8 goes first, then 7, then 6.
    expect(delays.slice(5, 8)).toEqual([40, 20, 0]);
  });

  it('does not make anything wait when nothing changes', () => {
    expect(frameDelays(4, 4).every((delay) => delay === 0)).toBe(true);
  });
});

const base = {
  saved: null,
  draft: UNRATED,
  editing: false,
  pending: false,
  justSaved: false,
  loading: false,
};

describe('ratingView', () => {
  it('starts unrated, with the hint and no button', () => {
    const view = ratingView(base);
    expect(view.mode).toBe('unrated');
    expect(view.value).toBe(0);
    expect(view.showHint).toBe(true);
    expect(view.showSave).toBe(false);
    expect(view.locked).toBe(false);
  });

  it('shows the save button once something is chosen, but never saves by itself', () => {
    const view = ratingView({ ...base, draft: 7 });
    expect(view.mode).toBe('draft');
    expect(view.value).toBe(7);
    expect(view.showSave).toBe(true);
    expect(view.showHint).toBe(false);
  });

  it('keeps the chosen value on the strip while saving, and locks it', () => {
    const view = ratingView({ ...base, draft: 7, pending: true });
    expect(view.mode).toBe('saving');
    expect(view.value).toBe(7);
    expect(view.showSave).toBe(true);
    expect(view.locked).toBe(true);
  });

  it('thanks right after saving, and offers to change', () => {
    const view = ratingView({ ...base, saved: 7, draft: 7, justSaved: true });
    expect(view.mode).toBe('saved');
    expect(view.showThanks).toBe(true);
    expect(view.showSave).toBe(false);
    expect(view.showChange).toBe(true);
    expect(view.locked).toBe(true);
  });

  it('says "your rating" when it comes back to a route already rated', () => {
    const view = ratingView({ ...base, saved: 7 });
    expect(view.mode).toBe('rated');
    expect(view.value).toBe(7);
    expect(view.showYours).toBe(true);
    expect(view.showThanks).toBe(false);
    expect(view.showChange).toBe(true);
  });

  it('wakes the strip with the current value when changing', () => {
    const view = ratingView({ ...base, saved: 7, draft: 7, editing: true });
    expect(view.mode).toBe('editing');
    expect(view.value).toBe(7);
    expect(view.locked).toBe(false);
    expect(view.showSave).toBe(true);
    expect(view.showChange).toBe(false);
  });

  it('follows the new number while changing', () => {
    const view = ratingView({ ...base, saved: 7, draft: 4, editing: true });
    expect(view.value).toBe(4);
  });

  it('waits, locked, until it knows whether there is a vote', () => {
    const view = ratingView({ ...base, loading: true });
    expect(view.mode).toBe('loading');
    expect(view.locked).toBe(true);
    expect(view.showHint).toBe(false);
  });

  it('keeps the value after a failed save so it can be tried again', () => {
    // A failure takes the request out of "pending": the draft is still there.
    const view = ratingView({ ...base, draft: 9 });
    expect(view.value).toBe(9);
    expect(view.showSave).toBe(true);
  });
});
