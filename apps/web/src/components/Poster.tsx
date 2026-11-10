import { Icon } from './Icon.js';

/**
 * A film poster. The title is always written next to it, so the image itself is
 * decoration (empty alt). Without a poster from TMDB, a quiet stand-in shows.
 */
export function Poster({ url }: { url: string | null }) {
  if (!url) {
    return (
      <i className="poster empty" aria-hidden="true">
        <Icon name="film" size={24} />
      </i>
    );
  }
  return (
    <i className="poster">
      <img src={url} alt="" loading="lazy" decoding="async" />
    </i>
  );
}

/** Overlapping posters on a route card. `null` marks a film with no poster. */
export function PosterStrip({ posters }: { posters: (string | null)[] }) {
  return (
    <div className="poster-strip" aria-hidden="true">
      {posters.map((url, index) => (
        <Poster key={index} url={url} />
      ))}
    </div>
  );
}
