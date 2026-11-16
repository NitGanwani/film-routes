import { RATING } from '@film-routes/shared';
import { useQuery } from '@tanstack/react-query';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useRateRoute } from '../api/mutations.js';
import { ratingQuery } from '../api/queries.js';
import { useToast } from '../components/toast/useToast.js';
import {
  firstKeyScore,
  pageStep,
  ratingView,
  scoreAt,
  UNRATED,
} from './rating.js';
import { RatingStrip } from './RatingStrip.js';

/**
 * "How was the journey?": a strip of film of ten frames that light up to the
 * score, with the number big above it. Under the strip there is a native range
 * (invisible), so the keyboard and the screen reader get everything for free;
 * the pointer is handled here, because the range alone does not always jump to
 * a press. Choosing does not save: a phone is touched by accident, so there is
 * a button. One vote per person and route: always a PUT, and "Change" wakes the
 * strip up again with the vote that stands. It is optional: nothing here
 * blocks closing the dialog.
 */
export function RatingPicker({
  routeId,
  author,
  onRated,
}: {
  routeId: string;
  /** The guide, who the thanks mention. */
  author: string;
  /** Whether a vote stands (so a dialog can say "Close" instead of "Later"). */
  onRated?: (voted: boolean) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const mine = useQuery(ratingQuery(routeId));
  const rate = useRateRoute(routeId);
  const saved = rate.data?.rating.score ?? mine.data?.rating?.score ?? null;

  const [draft, setDraft] = useState(UNRATED);
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [blink, setBlink] = useState(false);
  const view = ratingView({
    saved,
    draft,
    editing,
    pending: rate.isPending,
    justSaved,
    loading: mine.isPending,
  });

  const voted = saved !== null;
  useEffect(() => onRated?.(voted), [voted, onRated]);

  const rangeRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);

  // The number rises when it changes, not when the picker appears.
  const firstRender = useRef(true);
  useEffect(() => {
    firstRender.current = false;
  }, []);

  // The focus follows what the person did: the button that saved is gone, so it
  // goes to "Change"; and "Change" is gone when the strip wakes, so it goes there.
  useEffect(() => {
    if (view.mode === 'saved')
      changeRef.current?.focus({ preventScroll: true });
  }, [view.mode]);

  function pick(score: number) {
    if (score !== draft) setDraft(score);
  }

  function scoreFromPointer(event: PointerEvent) {
    const box = wrapRef.current?.getBoundingClientRect();
    return box ? scoreAt(event.clientX - box.left, box.width) : RATING.min;
  }

  function save(score: number) {
    rate.mutate(score, {
      onSuccess: () => {
        setEditing(false);
        setJustSaved(true);
        setBlink(true);
      },
      onError: (error) => toast.ratingFailed(error, () => save(score)),
    });
  }

  function startChanging() {
    setDraft(saved ?? UNRATED);
    setJustSaved(false);
    setEditing(true);
    // Once the range is awake (a disabled one cannot take the focus).
    window.setTimeout(
      () => rangeRef.current?.focus({ preventScroll: true }),
      0,
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (draft === UNRATED) {
      const first = firstKeyScore(event.key);
      if (first === null) return;
      event.preventDefault();
      pick(first);
      return;
    }
    const jump = pageStep(event.key, draft);
    if (jump === null) return;
    event.preventDefault();
    pick(jump);
  }

  const valueText = view.value
    ? t('rating.valueText', { score: view.value, max: RATING.max })
    : t('rating.unrated');

  return (
    <div className="rating">
      <label htmlFor={`${id}-range`} className="rating-prompt">
        {t('rating.prompt')}
      </label>

      <p className="rating-num" aria-hidden="true">
        <span
          key={view.value}
          className={firstRender.current ? undefined : 'rating-num-in'}
        >
          {view.value || '—'}
        </span>
      </p>

      <div
        ref={wrapRef}
        className="rating-wrap"
        data-locked={view.locked || undefined}
        data-blink={blink || undefined}
        onAnimationEnd={() => setBlink(false)}
        // The browser would take the focus off the range on a press (the strip
        // is not focusable): keep it, so the arrow keys go on from here.
        onMouseDown={(event) => {
          if (!view.locked) event.preventDefault();
        }}
        onPointerDown={(event) => {
          if (view.locked) return;
          wrapRef.current?.setPointerCapture(event.pointerId);
          dragging.current = true;
          pick(scoreFromPointer(event));
          rangeRef.current?.focus({ preventScroll: true });
        }}
        onPointerMove={(event) => {
          if (dragging.current) pick(scoreFromPointer(event));
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <input
          ref={rangeRef}
          id={`${id}-range`}
          type="range"
          className="rating-range"
          min={RATING.min}
          max={RATING.max}
          step={1}
          value={view.value || RATING.min}
          aria-valuetext={valueText}
          aria-describedby={`${id}-hint`}
          disabled={view.locked}
          onChange={(event) => pick(Number(event.target.value))}
          onKeyDown={onKeyDown}
        />
        <RatingStrip value={view.value} />
      </div>

      <div className="rating-scale" aria-hidden="true">
        <span>{RATING.min}</span>
        <span>{RATING.max}</span>
      </div>

      <p id={`${id}-hint`} className="rating-hint">
        {view.showHint && t('rating.hint')}
      </p>

      {view.showSave && (
        <button
          type="button"
          className="btn btn-primary rating-save"
          aria-disabled={rate.isPending || undefined}
          aria-busy={rate.isPending || undefined}
          onClick={() => {
            if (!rate.isPending) save(view.value);
          }}
        >
          {rate.isPending && (
            <svg
              className="arc-spin"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="12" r="8" pathLength="1" />
            </svg>
          )}
          {t('rating.save')}
        </button>
      )}

      {/* Always in the page, so what is put in it is read out once. */}
      <div role="status" className="rating-live">
        {view.showThanks && (
          <div className="rating-thanks">
            <p>{t('rating.thanks', { guide: author })}</p>
            <p className="rating-note">
              {t('rating.visibility', { n: RATING.minVotesToShowAverage })}
            </p>
          </div>
        )}
      </div>

      {view.showChange && (
        <p className="rating-yours">
          {view.showYours && (
            <>
              <span>{t('rating.yours', { score: view.value })}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <button
            ref={changeRef}
            type="button"
            className="rating-change"
            onClick={startChanging}
          >
            {t('rating.change')}
          </button>
        </p>
      )}
    </div>
  );
}
