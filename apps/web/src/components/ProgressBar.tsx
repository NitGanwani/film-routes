import type { StepState } from '../api/types.js';
import { FilmStrip, Frame } from './FilmStrip.js';

/** One film of the route, as far as its frame needs to know. */
export type ProgressFrame = { state: StepState; posterUrl: string | null };

/**
 * How many films are closed, as a strip of film with one frame per film (and a
 * progressbar for assistive tech). With the films, a closed one shows its poster
 * and the one being watched is lit; without them (a list only knows the count)
 * the first `closed` frames are lit.
 */
export function ProgressBar({
  closed,
  total,
  label,
  frames,
}: {
  closed: number;
  total: number;
  /** Already translated, e.g. "1 de 5 cerradas". */
  label: string;
  /** The route's films in order, when they are known. */
  frames?: ProgressFrame[];
}) {
  return (
    <div className="progress">
      <FilmStrip
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={closed}
      >
        {frames
          ? frames.map((frame, index) => (
              <Frame
                key={index}
                state={frame.state}
                posterUrl={frame.posterUrl}
              />
            ))
          : Array.from({ length: total }, (_, index) => (
              <Frame
                key={index}
                state={index < closed ? 'closed' : 'pending'}
              />
            ))}
      </FilmStrip>
      <span>{label}</span>
    </div>
  );
}
