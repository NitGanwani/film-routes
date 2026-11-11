import { ViewTransition, type ReactElement } from 'react';

/**
 * Marks an element that exists on two pages so the browser moves it from one to
 * the other when the person navigates (the View Transitions API, through
 * React's <ViewTransition>). The name pairs the two copies; React only gives
 * it to the elements while a transition runs, so a list of cards never holds
 * two of the same name. Nothing else animates here, and a browser without the
 * API (or a person who asks for less motion) simply sees the page change.
 */
export function Shared({
  name,
  kind,
  children,
}: {
  /** Same on both pages, e.g. "poster-<routeId>"; null = not shared. */
  name: string | null;
  kind: 'poster' | 'title';
  children: ReactElement;
}) {
  if (!name) return children;
  return (
    <ViewTransition name={name} share={`shared-${kind}`} default="none">
      {children}
    </ViewTransition>
  );
}
