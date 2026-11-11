import { EMOTIONS } from '@film-routes/shared';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { EmotionBadge } from '../components/EmotionBadge.js';
import { Locked } from '../components/Locked.js';
import { FilmStrip } from '../components/FilmStrip.js';
import { safeNextPath } from '../session/nextPath.js';
import { SAMPLE_POSTERS } from '../tutorial/sample.js';
import {
  isLastStep,
  moveStep,
  TUTORIAL_STEPS,
  type TutorialStepId,
} from '../tutorial/steps.js';

/**
 * A short, optional walk through how a route works. People land here right
 * after signing up, and it is always reachable from "How it works".
 */
export function WelcomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const [index, setIndex] = useState(0);

  const id = TUTORIAL_STEPS[index] ?? TUTORIAL_STEPS[0];
  const last = isLastStep(index);
  const leave = () => void navigate(next, { replace: true });

  return (
    <div className="page narrow">
      <header className="auth-head">
        <h1>{t('tutorial.title')}</h1>
        <p>{t('tutorial.intro')}</p>
      </header>

      <section className="card card-pad tutorial" aria-live="polite">
        <p className="note">
          {t('tutorial.stepOf', {
            current: index + 1,
            total: TUTORIAL_STEPS.length,
          })}
        </p>
        <div className="tutorial-figure" aria-hidden="true">
          <Figure id={id} />
        </div>
        <h2>{t(`tutorial.${id}.title`)}</h2>
        <p>{t(`tutorial.${id}.text`)}</p>
        <ol className="dots" aria-hidden="true">
          {TUTORIAL_STEPS.map((step, position) => (
            <li key={step} data-active={position === index} />
          ))}
        </ol>
      </section>

      <div className="tutorial-actions">
        {index > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setIndex(moveStep(index, -1))}
          >
            {t('tutorial.previous')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={last ? leave : () => setIndex(moveStep(index, 1))}
        >
          {last ? t('tutorial.finish') : t('tutorial.next')}
        </button>
      </div>
      {!last && (
        <p className="tutorial-skip">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={leave}
          >
            {t('tutorial.skip')}
          </button>
        </p>
      )}
    </div>
  );
}

/** A tiny picture of each idea, made from the real pieces of the app. */
function Figure({ id }: { id: TutorialStepId }): ReactNode {
  const { t } = useTranslation();
  switch (id) {
    case 'routes':
      // A strip of film with four posters in a row: the films of a route.
      return (
        <FilmStrip
          label=""
          frames={SAMPLE_POSTERS.map((posterUrl) => ({
            posterUrl,
            state: 'closed' as const,
          }))}
        />
      );
    case 'noSpoilers':
      return (
        <div className="tutorial-notes">
          <p className="note-text">
            <span className="note-label">{t('journey.noteBefore')}</span>
            <q>{t('tutorial.noSpoilers.sample')}</q>
          </p>
          <Locked
            text={t('journey.noteAfterLocked', { author: t('tutorial.guide') })}
          />
        </div>
      );
    case 'emotion':
      // One emotion is picked; the others wait, dimmed.
      return (
        <div className="tutorial-emotions">
          {EMOTIONS.map((emotion) => (
            <EmotionBadge
              key={emotion}
              emotion={emotion}
              state={emotion === 'tenderness' ? 'chosen' : 'dimmed'}
            />
          ))}
        </div>
      );
    case 'compare':
      return (
        <div className="compare">
          <div>
            <span className="who">{t('journey.you')}</span>
            <EmotionBadge emotion="awe" />
          </div>
          <span className="vs">{t('journey.different')}</span>
          <div>
            <span className="who">{t('tutorial.guide')}</span>
            <EmotionBadge emotion="thoughtful" />
          </div>
        </div>
      );
  }
}
