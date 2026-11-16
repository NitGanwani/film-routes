import {
  ENVELOPE_FRAMES,
  ENVELOPE_HOLES,
  type EnvelopeState,
} from './model.js';

/**
 * The picture of the invitation: a closed envelope that is a strip of film
 * with its frames switched off, and a flap with the amber frame of the logo.
 * Accepting opens it (`open`): the flap tilts back and the frames light one
 * after another (the amber layers of `env-lit` fade and grow in). The problems have their own variant of the strip, so the
 * picture says what the words say: a frame crossed out (the link is used up or
 * switched off), switched off (it ran out or you are out), lit (the route is
 * yours) or locked (it was taken down). The CSS does the motion, and drops it
 * with reduced motion. It shows nothing of the route, because the API does not
 * say anything about it before it is accepted.
 */
export function InviteEnvelope({ state }: { state: EnvelopeState }) {
  return (
    <svg
      className="invite-env"
      data-state={state}
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
        {ENVELOPE_HOLES.map((x) => (
          <g key={x}>
            <rect x={x} y="35" width="5" height="3.5" rx="1" />
            <rect x={x} y="77.5" width="5" height="3.5" rx="1" />
          </g>
        ))}
      </g>
      <g className="frames">
        {ENVELOPE_FRAMES.map((x) => (
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
      <g>
        {ENVELOPE_FRAMES.map((x) => (
          <rect
            key={x}
            className="env-lit"
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
      <path
        className="env-strike"
        d="M58 76 L102 40"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <g className="env-lock">
        <rect
          className="env-lock-plate"
          x="68"
          y="47"
          width="24"
          height="22"
          rx="3"
        />
        <rect x="72" y="56" width="16" height="11" rx="2" strokeWidth="2" />
        <path
          d="M75 56v-3a5 5 0 0 1 10 0v3"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
