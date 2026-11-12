/**
 * Icons from the design, as one inline sprite drawn once (see `IconSprite`) and
 * referenced with <use>. Emotions each have a different SHAPE, so they can be
 * told apart without colour.
 */
export type IconName =
  | 'joy'
  | 'tenderness'
  | 'awe'
  | 'thoughtful'
  | 'tension'
  | 'fear'
  | 'sadness'
  | 'discomfort'
  | 'lock'
  | 'alert'
  | 'info'
  | 'back'
  | 'check'
  | 'flag'
  | 'link'
  | 'eye-off'
  | 'film'
  | 'compass'
  | 'journey'
  | 'pencil'
  | 'globe';

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  );
}

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
} as const;

/** Render once, near the top of the page. */
export function IconSprite() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute' }}
      aria-hidden="true"
      focusable="false"
    >
      <symbol id="i-joy" viewBox="0 0 24 24" {...line} strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </symbol>
      <symbol
        id="i-tenderness"
        viewBox="0 0 24 24"
        {...line}
        strokeLinejoin="round"
      >
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </symbol>
      <symbol id="i-awe" viewBox="0 0 24 24" {...line} strokeLinejoin="round">
        <path d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8z" />
      </symbol>
      <symbol
        id="i-thoughtful"
        viewBox="0 0 24 24"
        {...line}
        strokeLinecap="round"
      >
        <path d="M14 3.5A8.5 8.5 0 1 0 20.5 10 6.5 6.5 0 0 1 14 3.5z" />
      </symbol>
      <symbol
        id="i-tension"
        viewBox="0 0 24 24"
        {...line}
        strokeLinejoin="round"
      >
        <path d="M13 2 5 13h6l-1 9 9-12h-6l1-8z" />
      </symbol>
      <symbol id="i-fear" viewBox="0 0 24 24" {...line} strokeLinecap="round">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
        <circle cx="12" cy="12" r="2.5" />
      </symbol>
      <symbol
        id="i-sadness"
        viewBox="0 0 24 24"
        {...line}
        strokeLinejoin="round"
      >
        <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
      </symbol>
      <symbol
        id="i-discomfort"
        viewBox="0 0 24 24"
        {...line}
        strokeLinecap="round"
      >
        <path d="M3 9c2-3 4-3 6 0s4 3 6 0 4-3 6 0M3 15c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      </symbol>
      <symbol id="i-lock" viewBox="0 0 24 24" {...line} strokeLinecap="round">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </symbol>
      <symbol id="i-alert" viewBox="0 0 24 24" {...line} strokeLinecap="round">
        <path d="M12 3 2 21h20L12 3z" />
        <path d="M12 10v5M12 18h.01" />
      </symbol>
      <symbol id="i-info" viewBox="0 0 24 24" {...line} strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </symbol>
      <symbol
        id="i-back"
        viewBox="0 0 24 24"
        {...line}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 5l-7 7 7 7" />
      </symbol>
      <symbol
        id="i-check"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12.5l4.5 4.5L19 7" />
      </symbol>
      <symbol
        id="i-flag"
        viewBox="0 0 24 24"
        {...line}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 21V4h12l-2 4 2 4H5" />
      </symbol>
      <symbol id="i-link" viewBox="0 0 24 24" {...line} strokeLinecap="round">
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </symbol>
      <symbol
        id="i-eye-off"
        viewBox="0 0 24 24"
        {...line}
        strokeLinecap="round"
      >
        <path d="M3 3l18 18M10.6 10.6A2.5 2.5 0 0 0 13.4 13.4M9.9 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 4.4-1" />
      </symbol>
      <symbol
        id="i-film"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
      </symbol>
      {/* Navigation: explore (a compass), my journeys (a winding path between
          two points), my routes (a pencil: the ones I write) and a globe. */}
      <symbol
        id="i-compass"
        viewBox="0 0 24 24"
        {...line}
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5l-2 5-5 2 2-5z" />
      </symbol>
      <symbol
        id="i-journey"
        viewBox="0 0 24 24"
        {...line}
        strokeLinecap="round"
      >
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="6" r="2" />
        <path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" />
      </symbol>
      <symbol
        id="i-pencil"
        viewBox="0 0 24 24"
        {...line}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z" />
        <path d="M14.5 6.5l3 3" />
      </symbol>
      <symbol id="i-globe" viewBox="0 0 24 24" {...line} strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
      </symbol>
    </svg>
  );
}
