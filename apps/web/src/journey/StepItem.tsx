import * as m from 'motion/react-m';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { JourneyStep } from '../api/types.js';
import { EmotionBadge } from '../components/EmotionBadge.js';
import { Locked } from '../components/Locked.js';
import { Poster } from '../components/Poster.js';
import { filmTitle, originalTitleNote } from '../films/titles.js';
import { compareEmotions, stepActions } from './model.js';

/** The reveal of a closed film and the glide of the list: short, easing out. */
const REVEAL_TRANSITION = { duration: 0.3, ease: [0.22, 1, 0.36, 1] } as const;

/**
 * One film of a journey, as the traveler sees it: what has opened and what has
 * not. The journey draws it, and so does the author's preview of it.
 */
export type StepItemProps = {
  step: JourneyStep;
  /** Set on the first step: its poster is the one that arrives from the card. */
  transitionName: string | null;
  author: string;
  following: boolean;
  busy: boolean;
  onStart: () => void;
  onOpenClose: (seenBefore: boolean) => void;
};

export function StepItem({
  step,
  transitionName,
  author,
  following,
  busy,
  onStart,
  onOpenClose,
}: StepItemProps) {
  const { t, i18n } = useTranslation();
  const shown = filmTitle(step.film, i18n.language);
  const original = originalTitleNote(step.film, shown);
  const actions = stepActions(step, following);
  const comparison = compareEmotions(step.myEmotion, step.authorEmotion);
  const chip =
    step.state === 'closed' ? null : step.state === 'started' ? (
      <span className="chip chip-live">{t('journey.stateStarted')}</span>
    ) : step.recommendedNext ? (
      <span className="chip chip-next">{t('journey.stateNext')}</span>
    ) : (
      <span className="chip chip-state">{t('journey.statePending')}</span>
    );
  const hasButtons = actions.start || actions.closeWatched || actions.closeSeen;
  // What a closed film reveals (the author's emotion and the note after) fades
  // in and rises a little, but only when it is the person who just closed it:
  // films that were already closed when the page opened are simply there.
  const closedOnLoad = useRef(step.state === 'closed');
  const reveal = closedOnLoad.current
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: REVEAL_TRANSITION,
      };

  return (
    // `layout`: when this film grows (its notes open) the ones below glide down
    // instead of jumping.
    <m.li
      layout
      transition={{ layout: REVEAL_TRANSITION }}
      className="step"
      data-state={step.state}
      data-next={step.recommendedNext}
    >
      <span className="num">{step.position}</span>
      <Poster url={step.film.posterUrl} transitionName={transitionName} />
      <div className="body">
        <div className="main">
          <div className="head">
            <h2>
              {shown}
              {step.film.releaseYear !== null && (
                <>
                  {' '}
                  <span className="year">{step.film.releaseYear}</span>
                </>
              )}
              {original && <span className="orig">{original}</span>}
            </h2>
            {chip}
          </div>

          {step.state === 'closed' && step.myEmotion && (
            <>
              <div className="compare">
                <div>
                  <span className="who">{t('journey.you')}</span>
                  <EmotionBadge emotion={step.myEmotion} />
                </div>
                {step.authorEmotion && comparison && (
                  <>
                    <m.span
                      className={`vs${comparison === 'same' ? ' same' : ''}`}
                      {...reveal}
                    >
                      {t(`journey.${comparison}`)}
                    </m.span>
                    <m.div {...reveal}>
                      <span className="who">{author}</span>
                      <EmotionBadge emotion={step.authorEmotion} />
                    </m.div>
                  </>
                )}
              </div>
              {step.myComment && (
                <p className="note-text">
                  <span className="note-label">{t('journey.yourComment')}</span>
                  {step.myComment}
                </p>
              )}
            </>
          )}
        </div>

        <div className="aside">
          {step.noteBeforeLocked ? (
            <Locked text={t('journey.noteBeforeLocked')} />
          ) : (
            step.noteBefore && (
              <p className="note-text">
                <span className="note-label">{t('journey.noteBefore')}</span>
                <q>{step.noteBefore}</q>
              </p>
            )
          )}
          {step.state === 'closed' ? (
            step.noteAfter && (
              <m.p className="note-text" {...reveal}>
                <span className="note-label">
                  {t('journey.noteAfter', { author })}
                </span>
                <q>{step.noteAfter}</q>
              </m.p>
            )
          ) : (
            <Locked text={t('journey.noteAfterLocked', { author })} />
          )}
        </div>

        {hasButtons && (
          <div className="actions">
            {actions.start && (
              <button
                type="button"
                className={
                  step.recommendedNext
                    ? 'btn btn-secondary'
                    : 'btn btn-ghost btn-sm'
                }
                disabled={busy}
                onClick={onStart}
              >
                {step.recommendedNext
                  ? t('journey.start')
                  : t('journey.startOutOfOrder')}
              </button>
            )}
            {actions.closeWatched && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => onOpenClose(false)}
              >
                {t('journey.closeWatched')}
              </button>
            )}
            {actions.closeSeen && (
              <button
                type="button"
                className={
                  step.recommendedNext
                    ? 'btn btn-ghost'
                    : 'btn btn-ghost btn-sm'
                }
                disabled={busy}
                onClick={() => onOpenClose(true)}
              >
                {t('journey.closeSeen')}
              </button>
            )}
          </div>
        )}
      </div>
    </m.li>
  );
}
