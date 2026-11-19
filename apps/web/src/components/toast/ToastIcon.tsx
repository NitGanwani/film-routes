import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import type { ToastKind } from './model.js';

/** Fable's curves: a stroke draws with a slow middle, a shape settles out. */
const DRAW = { duration: 0.32, ease: [0.65, 0, 0.35, 1] } as const;
const SETTLE = { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } as const;

/**
 * The picture of a notice, drawn stroke by stroke when it comes in (the same
 * idea as the logo, which draws itself). Each kind has its own: a tick, two
 * links of a chain, a film frame that lights up, an exclamation mark. With
 * reduced motion it is simply there, already drawn.
 */
export function ToastIcon({ kind }: { kind: ToastKind }) {
  const still = useReducedMotion() === true;

  // `initial={false}` starts an element at its final look.
  const draw = (delay: number) => ({
    initial: still ? (false as const) : { pathLength: 0 },
    animate: { pathLength: 1 },
    transition: { ...DRAW, delay },
  });
  const pop = {
    initial: still ? (false as const) : { scale: 0.6, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { ...SETTLE, delay: 0.06 },
    style: { transformOrigin: 'center' },
  };
  const light = (delay: number) => ({
    initial: still ? (false as const) : { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.26, ease: SETTLE.ease, delay },
  });

  return (
    <svg
      className={`toast-icon toast-icon-${kind}`}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'changes' && (
        <>
          <m.circle
            className="stroke-success"
            cx="12"
            cy="12"
            r="9.5"
            {...pop}
          />
          <m.path
            className="stroke-success"
            d="M7.5 12.5l3 3L16.5 9"
            {...draw(0.12)}
          />
        </>
      )}
      {kind === 'copied' && (
        <>
          <m.path
            className="stroke-light"
            d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1"
            {...draw(0.12)}
          />
          <m.path
            className="stroke-light"
            d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"
            {...draw(0.26)}
          />
        </>
      )}
      {kind === 'invite' && (
        <>
          <m.rect
            className="fill-accent"
            x="3"
            y="6"
            width="18"
            height="12"
            rx="2"
            stroke="none"
            {...light(0.38)}
          />
          <m.rect
            className="stroke-light"
            x="3"
            y="6"
            width="18"
            height="12"
            rx="2"
            {...draw(0.12)}
          />
          <m.g className="fill-notch" stroke="none" {...light(0.38)}>
            <rect x="7" y="6" width="2" height="1.6" />
            <rect x="15" y="6" width="2" height="1.6" />
            <rect x="7" y="16.4" width="2" height="1.6" />
            <rect x="15" y="16.4" width="2" height="1.6" />
          </m.g>
        </>
      )}
      {kind === 'update' && (
        <>
          <m.path
            className="stroke-light"
            d="M20 12a8 8 0 1 1-2.34-5.66"
            {...draw(0.1)}
          />
          <m.path className="stroke-light" d="M20 4v5h-5" {...draw(0.34)} />
        </>
      )}
      {kind === 'error' && (
        <>
          <m.circle
            className="stroke-danger"
            cx="12"
            cy="12"
            r="9.5"
            {...pop}
          />
          <m.path className="stroke-danger" d="M12 7.5v5.5" {...draw(0.08)} />
          <m.path className="stroke-danger" d="M12 16.2v.3" {...light(0.42)} />
        </>
      )}
    </svg>
  );
}
