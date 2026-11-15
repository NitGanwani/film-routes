import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiError } from '../api/client.js';
import { useTravelerJourney } from '../api/queries.js';
import type { AuthorRouteDetail, TravelerStep } from '../api/types.js';
import { Avatar } from '../components/Avatar.js';
import { errorMessage } from '../components/errorMessage.js';
import { FilmStrip } from '../components/FilmStrip.js';
import { Icon } from '../components/Icon.js';
import { Locked } from '../components/Locked.js';
import { Poster } from '../components/Poster.js';
import { EmptyState, ErrorBox } from '../components/States.js';
import { filmTitle, originalTitleNote } from '../films/titles.js';
import { EmotionCompare } from '../journey/EmotionCompare.js';
import { compareEmotions } from '../journey/model.js';
import { formatDay } from './invites.js';
import { TravelerChip } from './TravelerChip.js';
import { tabPath } from './tabs.js';
import { journeyFrames, matchSummary } from './travelers.js';

/** The rows that come in softly one after another; the rest are simply there. */
const STAGGER_ROWS = 10;

/**
 * One traveler's journey as the author reads it: film by film, what the
 * author felt next to what the traveler did, and the comment they left. A film
 * that is not closed shows nothing of theirs, just that it is still ahead.
 */
export function TravelerDetail({
  route,
  enrollmentId,
}: {
  route: AuthorRouteDetail;
  enrollmentId: string;
}) {
  const { t, i18n } = useTranslation();
  const journey = useTravelerJourney(route.id, enrollmentId);
  const back = (
    <Link className="back-link" to={tabPath(route.id, 'travelers')}>
      <Icon name="back" size={18} />
      {t('tabs.travelers')}
    </Link>
  );

  if (journey.isPending) {
    return (
      <div className="traveler-detail" aria-busy="true">
        {back}
        <div className="skel" style={{ height: '72px' }} />
        <div className="skel" style={{ height: '120px' }} />
        <p className="visually-hidden" role="status">
          {t('common.loading')}
        </p>
      </div>
    );
  }
  if (journey.isError) {
    const gone =
      journey.error instanceof ApiError &&
      (journey.error.status === 404 || journey.error.status === 400);
    return (
      <div className="traveler-detail">
        {back}
        {gone ? (
          <EmptyState title={t('travelers.detail.notFound')} />
        ) : (
          <ErrorBox
            message={errorMessage(t, journey.error)}
            onRetry={() => void journey.refetch()}
          />
        )}
      </div>
    );
  }

  const { traveler, steps } = journey.data;
  const day = (iso: string) => formatDay(iso, i18n.language, new Date());
  const matches = matchSummary(steps);
  const label = t('travelers.closedOf', {
    closed: traveler.closedSteps,
    total: traveler.stepCount,
  });

  return (
    <div className="traveler-detail">
      {back}

      <header className="traveler-head">
        <Avatar name={traveler.username} />
        <div>
          <h2>{traveler.username}</h2>
          <p className="traveler-dates">
            {t('travelers.detail.started', { date: day(traveler.startedAt) })}
            {traveler.completedAt &&
              ` · ${t('travelers.detail.finished', { date: day(traveler.completedAt) })}`}
          </p>
        </div>
        <TravelerChip status={traveler.status} />
      </header>

      <div className="progress">
        <FilmStrip frames={journeyFrames(steps)} label={label} />
        <span aria-hidden="true">{label}</span>
      </div>

      {matches && (
        <p className="traveler-match">
          <Icon name="check" size={16} />
          {t('travelers.detail.summary', matches)}
        </p>
      )}

      <ol className="steps traveler-steps">
        {steps.map((step, index) => (
          <TravelerStepRow
            key={step.id}
            step={step}
            index={index}
            name={traveler.username}
          />
        ))}
      </ol>
    </div>
  );
}

function TravelerStepRow({
  step,
  index,
  name,
}: {
  step: TravelerStep;
  index: number;
  name: string;
}) {
  const { t, i18n } = useTranslation();
  const shown = filmTitle(step.film, i18n.language);
  const original = originalTitleNote(step.film, shown);
  const closed = step.state === 'closed';

  return (
    <li
      className="step traveler-step"
      data-state={step.state}
      style={{ '--i': Math.min(index, STAGGER_ROWS - 1) } as CSSProperties}
    >
      <span className="num">{step.position}</span>
      <Poster url={step.film.posterUrl} />
      <div className="body">
        <div className="main">
          <div className="head">
            <h3>
              {shown}
              {step.film.releaseYear !== null && (
                <>
                  {' '}
                  <span className="year">{step.film.releaseYear}</span>
                </>
              )}
              {original && <span className="orig">{original}</span>}
            </h3>
          </div>

          {closed ? (
            <>
              <EmotionCompare
                className="traveler-compare"
                left={{
                  label: t('travelers.detail.me'),
                  emotion: step.authorEmotion,
                  empty: t('travelers.detail.noEmotion'),
                }}
                right={{ label: name, emotion: step.travelerEmotion }}
                comparison={compareEmotions(
                  step.authorEmotion,
                  step.travelerEmotion,
                )}
              />
              {step.travelerComment ? (
                <p className="note-text">
                  <q>{step.travelerComment}</q>
                </p>
              ) : (
                <p className="note-text compare-empty">
                  {t('travelers.detail.noComment')}
                </p>
              )}
            </>
          ) : (
            <Locked text={t('travelers.detail.notClosed')} />
          )}
        </div>
      </div>
    </li>
  );
}
