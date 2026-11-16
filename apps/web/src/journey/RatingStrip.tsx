import { useEffect, useRef, type CSSProperties } from 'react';
import { FRAME_COUNT, frameDelays } from './rating.js';

/** Where the perforations (20 on each edge) and the frames sit, in the 340 x 56 drawing. */
const HOLES = Array.from({ length: 20 }, (_, index) => 8 + index * 17);
const FRAMES = Array.from(
  { length: FRAME_COUNT },
  (_, index) => 7 + index * 33,
);

/**
 * The strip of film of the score (rating-strip.svg): ten frames that light up
 * to the score. It is the same drawing as the progress strip and the logo, so
 * what already meant "done" now means "how much". A picture only: the range
 * above it is what the keyboard and the screen reader use. The frames that are
 * off keep their border, so they can be counted without seeing the colour.
 */
export function RatingStrip({ value }: { value: number }) {
  // The frames that change wait for the one before: each one is a CSS delay,
  // worked out from the value that was drawn before this one.
  const before = useRef(value);
  const delays = frameDelays(before.current, value);
  useEffect(() => {
    before.current = value;
  }, [value]);

  return (
    <svg
      className="rating-strip"
      viewBox="0 0 340 56"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="rating-film" width="340" height="56" rx="6" />
      <g className="rating-hole">
        {HOLES.map((x) => (
          <g key={x}>
            <rect x={x} y="4" width="5" height="3.5" rx="1" />
            <rect x={x} y="48.5" width="5" height="3.5" rx="1" />
          </g>
        ))}
      </g>
      {FRAMES.map((x, index) => (
        <rect
          key={x}
          className="rating-frame"
          data-on={index < value || undefined}
          style={{ '--d': `${delays[index]}ms` } as CSSProperties}
          x={x}
          y="12"
          width="29"
          height="32"
          rx="2.5"
        />
      ))}
    </svg>
  );
}
