import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { backdropSources } from '../films/images.js';
import { PosterStrip } from './Poster.js';

/** What the browser needs to pick a cover width: the card's share of the row. */
const COVER_SIZES = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw';
const FEATURED_COVER_SIZES =
  '(min-width: 1024px) 66vw, (min-width: 640px) 50vw, 100vw';

/**
 * A route in a list. The top is a 16:9 picture: the backdrop of its first film
 * fading into the card, with the first posters over the fade. Without a
 * backdrop the area is plain and the posters sit in its middle. When the card
 * has a link, the whole card is clickable (the title's link stretches over it),
 * but only the title is announced.
 */
export function RouteCard({
  to,
  title,
  by,
  posters,
  cover = null,
  featured = false,
  badges,
  children,
}: {
  to: string | null;
  title: string;
  by: string;
  posters: (string | null)[];
  /** The route's `coverUrl`; null when the first film has no backdrop. */
  cover?: string | null;
  /** The big card at the head of a list: wider, with a larger title, on wide screens. */
  featured?: boolean;
  badges?: ReactNode;
  children?: ReactNode;
}) {
  const sources = cover ? backdropSources(cover) : null;
  return (
    <li className={featured ? 'card route-card featured' : 'card route-card'}>
      <div
        className={sources ? 'route-card-media has-cover' : 'route-card-media'}
        aria-hidden="true"
      >
        {sources && (
          <img
            className="cover"
            src={sources.src}
            srcSet={sources.srcSet}
            sizes={featured ? FEATURED_COVER_SIZES : COVER_SIZES}
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
        <PosterStrip posters={posters} />
      </div>
      <div className="route-card-main">
        {badges && <div className="badges">{badges}</div>}
        <h3>{to ? <Link to={to}>{title}</Link> : title}</h3>
        <p className="by">{by}</p>
        {children}
      </div>
    </li>
  );
}
