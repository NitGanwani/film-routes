/** Where the perforations of the film sit along its top and bottom edge. */
const HOLES = Array.from({ length: 8 }, (_, index) => 16 + index * 18);
const FRAMES = [16, 60, 104];

/**
 * The picture of the invitation: a closed envelope that is a strip of film
 * with its frames switched off, and a flap with the amber frame of the logo.
 * Accepting opens it: the flap turns up and the frames light one after another
 * (the CSS does it, and drops it with reduced motion). It shows nothing of the
 * route, because the API does not say anything about it before it is accepted.
 */
export function InviteEnvelope({ open }: { open: boolean }) {
  return (
    <svg
      className="invite-env"
      data-open={open || undefined}
      viewBox="0 0 160 100"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        className="env-body"
        x="8"
        y="30"
        width="144"
        height="56"
        rx="6"
        strokeWidth="1.5"
      />
      <g className="env-hole">
        {HOLES.map((x) => (
          <g key={x}>
            <rect x={x} y="35" width="5" height="3.5" rx="1" />
            <rect x={x} y="77.5" width="5" height="3.5" rx="1" />
          </g>
        ))}
      </g>
      <g>
        {FRAMES.map((x) => (
          <rect
            key={x}
            className="env-frame"
            x={x}
            y="43"
            width="40"
            height="30"
            rx="2.5"
          />
        ))}
      </g>
      <g className="env-flap">
        <path
          className="env-flap-shape"
          d="M8 30 L80 70 L152 30 Z"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <rect
          className="env-stamp"
          x="66"
          y="32"
          width="28"
          height="18"
          rx="2.5"
        />
        <g className="env-notch">
          <rect x="72" y="32" width="3" height="2.5" />
          <rect x="72" y="47.5" width="3" height="2.5" />
          <rect x="85" y="32" width="3" height="2.5" />
          <rect x="85" y="47.5" width="3" height="2.5" />
        </g>
      </g>
    </svg>
  );
}
