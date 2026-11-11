import { Icon } from './Icon.js';
import { Shared } from './Shared.js';

/**
 * A film poster. The title is always written next to it, so the image itself is
 * decoration (empty alt). Without a poster from TMDB, a quiet stand-in shows.
 */
export function Poster({
  url,
  transitionName = null,
}: {
  url: string | null;
  /** Set when this poster travels to another page (see Shared). */
  transitionName?: string | null;
}) {
  const poster = url ? (
    <i className="poster">
      <img src={url} alt="" loading="lazy" decoding="async" />
    </i>
  ) : (
    <i className="poster empty" aria-hidden="true">
      <Icon name="film" size={24} />
    </i>
  );
  return (
    <Shared name={transitionName} kind="poster">
      {poster}
    </Shared>
  );
}

/** Overlapping posters on a route card. `null` marks a film with no poster. */
export function PosterStrip({
  posters,
  transitionName = null,
}: {
  posters: (string | null)[];
  /** Given to the first poster, the one that travels to the route's page. */
  transitionName?: string | null;
}) {
  return (
    <div className="poster-strip" aria-hidden="true">
      {posters.map((url, index) => (
        <Poster
          key={index}
          url={url}
          transitionName={index === 0 ? transitionName : null}
        />
      ))}
    </div>
  );
}
