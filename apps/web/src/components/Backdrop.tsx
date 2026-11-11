import { backdropSources } from '../films/images.js';

/**
 * The wide image at the top of a route: the backdrop of its first film, fading
 * into the page colour towards the bottom so any text laid over it stays
 * readable. It is decoration (empty alt): the route's title is written beside
 * it. Without a backdrop from TMDB a faint amber glow shows instead, never a
 * stock picture.
 */
export function Backdrop({ url }: { url: string | null }) {
  if (!url) {
    return <div className="backdrop backdrop-empty" aria-hidden="true" />;
  }
  const { src, srcSet } = backdropSources(url);
  return (
    <div className="backdrop" aria-hidden="true">
      {/* It is the biggest thing on the page: load it first, not lazily. */}
      <img
        src={src}
        srcSet={srcSet}
        sizes="100vw"
        alt=""
        fetchPriority="high"
        decoding="async"
      />
    </div>
  );
}
