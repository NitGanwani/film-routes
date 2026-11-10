/** The tutorial's screens, in order. Each has its texts under `tutorial.<id>`. */
export const TUTORIAL_STEPS = [
  'routes',
  'noSpoilers',
  'emotion',
  'compare',
] as const;

export type TutorialStepId = (typeof TUTORIAL_STEPS)[number];

/** Moves by `delta` screens, stopping at the first and the last. */
export function moveStep(index: number, delta: number): number {
  return Math.min(Math.max(index + delta, 0), TUTORIAL_STEPS.length - 1);
}

export function isLastStep(index: number): boolean {
  return index >= TUTORIAL_STEPS.length - 1;
}
