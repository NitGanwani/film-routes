import { describe, expect, it } from 'vitest';
import { isLastStep, moveStep, TUTORIAL_STEPS } from './steps.js';

describe('moveStep', () => {
  it('goes forward and back one screen at a time', () => {
    expect(moveStep(0, 1)).toBe(1);
    expect(moveStep(2, -1)).toBe(1);
  });

  it('stops at the first screen', () => {
    expect(moveStep(0, -1)).toBe(0);
  });

  it('stops at the last screen', () => {
    const last = TUTORIAL_STEPS.length - 1;
    expect(moveStep(last, 1)).toBe(last);
  });
});

describe('isLastStep', () => {
  it('is true only on the last screen', () => {
    expect(isLastStep(TUTORIAL_STEPS.length - 2)).toBe(false);
    expect(isLastStep(TUTORIAL_STEPS.length - 1)).toBe(true);
  });
});
