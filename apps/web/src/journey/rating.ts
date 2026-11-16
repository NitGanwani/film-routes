import { RATING } from '@film-routes/shared';

/** How many frames the strip has: one per point of the scale. */
export const FRAME_COUNT = RATING.max - RATING.min + 1;

/** The x of the perforations (20 on each edge) and of the frames in the 340 x 56 drawing. */
export const STRIP_HOLES = Array.from(
  { length: 20 },
  (_, index) => 8 + index * 17,
);
export const STRIP_FRAMES = Array.from(
  { length: FRAME_COUNT },
  (_, index) => 7 + index * 33,
);

/** Nothing chosen yet. The range itself cannot be empty, so the state keeps 0. */
export const UNRATED = 0;

/** Each frame that changes waits this long for the one before it (ms). */
export const FRAME_STAGGER = 20;

/**
 * The score under a pointer, from its distance to the left edge of the strip.
 * Every frame owns a tenth of the width, so pressing anywhere on a frame (or
 * between two) picks it; the ends reach 1 and 10 even if the finger leaves the
 * strip while dragging. This is what the native range would do, but a native
 * range does not always jump to the press (iOS only drags), and it cannot
 * tell the first press on "1" from no press at all.
 */
export function scoreAt(x: number, width: number): number {
  if (!(width > 0)) return RATING.min;
  const index = Math.floor((x / width) * FRAME_COUNT);
  return Math.min(RATING.max, Math.max(RATING.min, RATING.min + index));
}

/**
 * What a key picks when nothing is chosen yet. The native range would start
 * from 1 and skip it (or do nothing at all on "back"), so the first key picks
 * a sensible score by itself: "end" the top, "page up" the first jump, and any
 * other key the first frame.
 */
export function firstKeyScore(key: string): number | null {
  switch (key) {
    case 'End':
      return RATING.max;
    case 'PageUp':
      return RATING.min + 2;
    case 'ArrowRight':
    case 'ArrowUp':
    case 'ArrowLeft':
    case 'ArrowDown':
    case 'Home':
    case 'PageDown':
      return RATING.min;
    default:
      return null;
  }
}

/** How far Page Up and Page Down jump. */
export const PAGE_STEP = 3;

/**
 * Where Page Up / Page Down leave the score. The native range moves by a tenth
 * of its length (a single point here, in Chrome), so the jump of three is done
 * by hand. Null for any other key.
 */
export function pageStep(key: string, current: number): number | null {
  if (key === 'PageUp') return Math.min(RATING.max, current + PAGE_STEP);
  if (key === 'PageDown') return Math.max(RATING.min, current - PAGE_STEP);
  return null;
}

/**
 * The delay (ms) of each frame's fill when the score goes from `from` to `to`:
 * the frames that change do it one after another, starting from the one that
 * was the last to change, and the rest do not wait.
 */
export function frameDelays(from: number, to: number): number[] {
  return Array.from({ length: FRAME_COUNT }, (_, index) => {
    const n = RATING.min + index;
    const wasOn = n <= from;
    const isOn = n <= to;
    if (wasOn === isOn) return 0;
    return isOn
      ? (n - from - 1) * FRAME_STAGGER // lighting up, from the first new one
      : (from - n) * FRAME_STAGGER; // going out, from the old top downwards
  });
}

export type RatingMode =
  /** Waiting to know whether this person already voted. */
  | 'loading'
  /** Nothing chosen. */
  | 'unrated'
  /** Chosen, not saved. */
  | 'draft'
  /** Changing a vote that stands. */
  | 'editing'
  | 'saving'
  /** Just saved: the thanks. */
  | 'saved'
  /** Back on a route that was already rated. */
  | 'rated';

export type RatingView = {
  mode: RatingMode;
  /** The score drawn on the strip and written as a number (0 = none). */
  value: number;
  /** The strip does not answer to the pointer or the keys. */
  locked: boolean;
  showHint: boolean;
  showSave: boolean;
  showThanks: boolean;
  showYours: boolean;
  /** "Change" is offered. */
  showChange: boolean;
};

/**
 * What the picker shows, from what is known: the vote on the server, the one
 * being chosen, and what the person is doing. One place decides it, so the
 * strip, the number and the buttons never disagree.
 */
export function ratingView(input: {
  saved: number | null;
  draft: number;
  editing: boolean;
  pending: boolean;
  justSaved: boolean;
  loading: boolean;
}): RatingView {
  const { saved, draft, editing, pending, justSaved, loading } = input;
  let mode: RatingMode;
  if (loading) mode = 'loading';
  else if (pending) mode = 'saving';
  else if (saved !== null && !editing) mode = justSaved ? 'saved' : 'rated';
  else if (editing) mode = 'editing';
  else mode = draft >= RATING.min ? 'draft' : 'unrated';

  const settled = mode === 'saved' || mode === 'rated';
  return {
    mode,
    value: settled ? (saved ?? UNRATED) : draft,
    locked: mode === 'loading' || mode === 'saving' || settled,
    showHint: mode === 'unrated',
    showSave: mode === 'draft' || mode === 'editing' || mode === 'saving',
    showThanks: mode === 'saved',
    showYours: mode === 'rated',
    showChange: settled,
  };
}
