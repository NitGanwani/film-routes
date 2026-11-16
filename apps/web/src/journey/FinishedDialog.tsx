import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Journey } from '../api/types.js';
import { Icon } from '../components/Icon.js';
import {
  afterStrip,
  finishPairs,
  finishSummary,
  frameDelay,
  stripFrames,
  type FinishPair,
} from './finish.js';
import { RatingPicker } from './RatingPicker.js';

const SETTLE = [0.2, 0.8, 0.2, 1] as const;
const DRAW_EASE = [0.65, 0, 0.35, 1] as const;

/**
 * "Route complete": the last film was just closed. Something like the credits
 * of a film: the logo draws itself and lights up, the title rises, the strip
 * lights one frame per film, then what you felt next to what the author felt,
 * and the score. About two seconds in all; it stays until the person closes
 * it. A native <dialog>, so the keyboard stays inside it and Esc closes it.
 * Reduced motion shows all of it at once, with only a fade.
 */
export function FinishedDialog({
  journey,
  onClose,
}: {
  journey: Journey;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const still = useReducedMotion() === true;
  // After a vote the "Later" button turns into "Close".
  const [voted, setVoted] = useState(false);

  const pairs = finishPairs(journey.steps);
  const { compared, same } = finishSummary(pairs);
  const timing = afterStrip(pairs.length);

  useEffect(() => {
    const dialog = dialogRef.current;
    // Guarded: in development React runs effects twice.
    if (dialog && !dialog.open) dialog.showModal();
    // The panel scrolls on a short screen and browsers would focus it first:
    // the focus starts on the close button instead.
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  /** A part of the scene that rises into place at its moment. */
  const rise = (delay: number, duration = 0.32) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: still ? 0.2 : duration,
      ease: SETTLE,
      delay: still ? 0 : delay,
    },
  });

  return (
    <dialog
      ref={dialogRef}
      className="sheet finish"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <m.div
        className="sheet-overlay"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: SETTLE }}
      />
      <m.div
        className="sheet-panel finish-panel"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
        transition={{ duration: 0.36, ease: SETTLE, delay: still ? 0 : 0.12 }}
      >
        <button
          type="button"
          ref={closeRef}
          className="finish-close"
          aria-label={t('journey.finished.close')}
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </button>

        <FinishMark still={still} />
        <m.p className="finish-eyebrow" {...rise(1.0)}>
          {t('journey.finished.eyebrow')}
        </m.p>
        <m.h2 id={titleId} className="finish-title" {...rise(1.08, 0.36)}>
          {t('journey.finished.title')}
        </m.h2>
        <m.p className="finish-sub" {...rise(1.18)}>
          {t('journey.finished.sub', {
            count: pairs.length,
            author: journey.route.author,
          })}
        </m.p>

        <FinishStrip count={pairs.length} still={still} />

        <m.div className="finish-compare" {...rise(timing.comparison)}>
          <EmotionRow
            who={t('journey.you')}
            pairs={pairs}
            side="mine"
            noEmotion={t('journey.finished.noEmotion')}
          />
          <EmotionRow
            who={journey.route.author}
            pairs={pairs}
            side="author"
            noEmotion={t('journey.finished.noEmotion')}
          />
        </m.div>
        {compared > 0 && (
          <m.p className="finish-match" {...rise(timing.match)}>
            {t('journey.finished.match', { same, total: compared })}
          </m.p>
        )}

        <m.div className="finish-rate" {...rise(timing.rating)}>
          <RatingPicker routeId={journey.route.id} onRated={setVoted} />
          <button type="button" className="finish-later" onClick={onClose}>
            {t(voted ? 'journey.finished.close' : 'journey.finished.later')}
          </button>
        </m.div>
      </m.div>
    </dialog>
  );
}

/** The logo's mark drawing itself: two frames drawn, the third lit amber. */
function FinishMark({ still }: { still: boolean }) {
  const draw = (delay: number) => ({
    initial: still ? (false as const) : { pathLength: 0 },
    animate: { pathLength: 1 },
    transition: { duration: 0.42, ease: DRAW_EASE, delay },
  });
  return (
    <svg
      className="finish-mark"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <m.rect
        x="2"
        y="43"
        width="28"
        height="18"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="4"
        {...draw(0.3)}
      />
      <m.rect
        x="18"
        y="23"
        width="28"
        height="18"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="4"
        {...draw(0.52)}
      />
      <m.g
        style={{ transformOrigin: '48px 12px' }}
        initial={still ? false : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.36, ease: SETTLE, delay: 0.8 }}
      >
        <rect
          className="finish-lit"
          x="34"
          y="3"
          width="28"
          height="18"
          rx="2.5"
        />
        <g className="finish-notch">
          <rect x="40" y="3" width="3" height="2.5" />
          <rect x="40" y="18.5" width="3" height="2.5" />
          <rect x="53" y="3" width="3" height="2.5" />
          <rect x="53" y="18.5" width="3" height="2.5" />
        </g>
      </m.g>
    </svg>
  );
}

/** A strip of film with one frame per film, lighting up one after another. */
function FinishStrip({ count, still }: { count: number; still: boolean }) {
  const frames = stripFrames(count);
  const holes = Array.from({ length: 13 }, (_, index) => 10 + index * 24);
  return (
    <svg
      className="finish-strip"
      viewBox="0 0 320 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="finish-film" width="320" height="64" rx="6" />
      <g className="finish-hole">
        {holes.map((x) => (
          <g key={x}>
            <rect x={x} y="5" width="6" height="4" rx="1" />
            <rect x={x} y="55" width="6" height="4" rx="1" />
          </g>
        ))}
      </g>
      {frames.map((frame, index) => (
        <m.rect
          key={frame.x}
          className="finish-lit"
          x={frame.x}
          y="14"
          width={frame.width}
          height="36"
          rx="3"
          style={{ transformOrigin: `${frame.x + frame.width / 2}px 32px` }}
          initial={still ? false : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: still ? 0.2 : 0.3,
            ease: SETTLE,
            delay: still ? 0 : frameDelay(index),
          }}
        />
      ))}
    </svg>
  );
}

/** One person's emotion for each film, in order: icon and name, never colour alone. */
function EmotionRow({
  who,
  pairs,
  side,
  noEmotion,
}: {
  who: string;
  pairs: readonly FinishPair[];
  side: 'mine' | 'author';
  noEmotion: string;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="finish-who">{who}</p>
      <ul className="finish-chips">
        {pairs.map((pair) => {
          const emotion = pair[side];
          return (
            <li
              key={pair.position}
              className="finish-chip"
              data-same={pair.same || undefined}
            >
              <span className="visually-hidden">{pair.position}. </span>
              {emotion ? (
                <>
                  <Icon name={emotion} size={14} />
                  {t(`emotions.${emotion}`)}
                </>
              ) : (
                noEmotion
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
