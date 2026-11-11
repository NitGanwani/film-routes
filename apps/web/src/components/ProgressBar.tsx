import { FilmStrip, type StripFrame } from './FilmStrip.js';

/**
 * How many films are closed, for a list that only knows the count (it cannot
 * tell which ones, since a route can be walked out of order): a strip with one
 * frame per film, the first `closed` of them lit, and the text beside it.
 */
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
  const frames: StripFrame[] = Array.from({ length: total }, (_, index) => ({
    posterUrl: null,
    state: index < closed ? 'closed' : 'pending',
  }));
  return (
    <div className="progress">
      <FilmStrip frames={frames} label={label} />
      <span aria-hidden="true">{label}</span>
    </div>
  );
}
