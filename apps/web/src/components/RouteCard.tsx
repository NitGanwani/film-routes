import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PosterStrip } from './Poster.js';

/**
 * A route in a list. When it has a link, the whole card is clickable (the
 * title's link stretches over the card), but only the title is announced.
 */
export function RouteCard({
  to,
  title,
  by,
  posters,
  badges,
  children,
}: {
  to: string | null;
  title: string;
  by: string;
  posters: (string | null)[];
  badges?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="card route-card">
      <div className="route-card-main">
        {badges && <div className="badges">{badges}</div>}
        <h3>{to ? <Link to={to}>{title}</Link> : title}</h3>
        <p className="by">{by}</p>
        {children}
      </div>
      <PosterStrip posters={posters} />
    </li>
  );
}
