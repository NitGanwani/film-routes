import type { AriaAttributes, ReactNode } from 'react';

/** What a frame of the strip shows. */
export type FrameState = 'empty' | 'pending' | 'started' | 'closed';

/**
 * A strip of film: a dark band with perforations along both edges and the
 * frames in between, in order, like the films of a route. Pure decoration: the
 * meaning always goes in text next to it (and, for progress, in its role).
 */
export function FilmStrip({
  children,
  ...aria
}: {
  children: ReactNode;
} & AriaAttributes & { role?: string }) {
  return (
    <div className="film-strip" {...aria}>
      <div className="film-frames" aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

/**
 * One frame. A closed film shows its poster; a pending one stays dark; one
 * being watched is lit softly; a closed one with no picture to show is lit.
 */
export function Frame({
  state,
  posterUrl = null,
}: {
  state: FrameState;
  posterUrl?: string | null;
}) {
  return (
    <span className="film-frame" data-state={state}>
      {state === 'closed' && posterUrl && (
        <img src={posterUrl} alt="" loading="lazy" decoding="async" />
      )}
    </span>
  );
}
