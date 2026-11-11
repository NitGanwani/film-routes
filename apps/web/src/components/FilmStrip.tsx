export type StripFrame = {
  /** Null when TMDB has no poster, or when only a count is known. */
  posterUrl: string | null;
  /** closed: its poster; started: its poster in an amber border; pending: still dark. */
  state: 'closed' | 'started' | 'pending';
};

/**
 * A strip of film: a dark band with perforations along both edges and one
 * frame per film, in the order of the route. It scrolls sideways (snapping to
 * each frame) when the frames do not fit. It is announced as one image with the
 * given `label`, since the meaning also goes in text next to it.
 */
export function FilmStrip({
  frames,
  label,
}: {
  frames: StripFrame[];
  /** Already translated, e.g. "1 de 5 cerradas". */
  label: string;
}) {
  return (
    <div className="film-strip" role="img" aria-label={label}>
      {frames.map((frame, index) => (
        <span key={index} className="film-frame" data-state={frame.state}>
          {frame.state !== 'pending' && frame.posterUrl && (
            <img src={frame.posterUrl} alt="" loading="lazy" decoding="async" />
          )}
        </span>
      ))}
    </div>
  );
}
