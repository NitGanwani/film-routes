import { progressPercent } from '../journey/model.js';

/** How many films are closed, as a bar for the eye and a progressbar for assistive tech. */
export function ProgressBar({
  closed,
  total,
  label,
}: {
  closed: number;
  total: number;
  /** Already translated, e.g. "1 de 5 cerradas". */
  label: string;
}) {
  return (
    <div className="progress">
      <div
        className="bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={closed}
      >
        <i style={{ width: `${progressPercent(closed, total)}%` }} />
      </div>
      <span>{label}</span>
    </div>
  );
}
