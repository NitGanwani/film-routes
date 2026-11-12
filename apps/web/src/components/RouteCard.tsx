import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { backdropSources } from '../films/images.js';
import { PosterStrip } from './Poster.js';
import { Shared } from './Shared.js';

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
  placeholder,
  featured = false,
  transitionId = null,
  onIntent,
  badges,
  children,
}: {
  to: string | null;
  title: string;
  /** The line under the title; a card with nothing to say there leaves it out. */
  by?: string;
  posters: (string | null)[];
  /** The route's `coverUrl`; null when the first film has no backdrop. */
  cover?: string | null;
  /** What fills the picture when there is no cover (decoration: the area is hidden from screen readers). */
  placeholder?: ReactNode;
  /** The big card at the head of a list: wider, with a larger title, on wide screens. */
  featured?: boolean;
  /** The route's id: its first poster and its title travel to the page it opens. */
  transitionId?: string | null;
  /** The person is about to open it (hover or focus): a chance to load it early. */
  onIntent?: () => void;
  badges?: ReactNode;
  children?: ReactNode;
}) {
  const sources = cover ? backdropSources(cover) : null;
  return (
    <li
      className={featured ? 'card route-card featured' : 'card route-card'}
      onPointerEnter={onIntent}
      onFocus={onIntent}
    >
      <div
        className={
          sources
            ? 'route-card-media has-cover'
            : placeholder
              ? 'route-card-media is-blank'
              : 'route-card-media'
        }
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
        {!sources && placeholder}
        <PosterStrip
          posters={posters}
          transitionName={transitionId ? `poster-${transitionId}` : null}
        />
      </div>
      <div className="route-card-main">
        {badges && <div className="badges">{badges}</div>}
        <Shared
          name={transitionId ? `title-${transitionId}` : null}
          kind="title"
        >
          <h3>{to ? <Link to={to}>{title}</Link> : title}</h3>
        </Shared>
        {by && <p className="by">{by}</p>}
        {children}
      </div>
    </li>
  );
}
