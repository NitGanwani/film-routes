import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client.js';
import { api } from '../api/instance.js';
import type { CloseStepBody, Journey, JourneyStep } from '../api/types.js';
import { Avatar } from '../components/Avatar.js';
import { EmotionBadge } from '../components/EmotionBadge.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon } from '../components/Icon.js';
import { Poster } from '../components/Poster.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { ErrorBox } from '../components/States.js';
import { CloseDialog } from '../journey/CloseDialog.js';
import { compareEmotions, stepActions } from '../journey/model.js';

type Closing = { stepId: string; seenBefore: boolean };

/** One traveler's view of a route: the films, what has opened, what has not. */
export function JourneyPage() {
  const { t } = useTranslation();
  const { routeId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queryKey = ['journey', routeId];

  const [closing, setClosing] = useState<Closing | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  const journey = useQuery({
    queryKey,
    queryFn: () =>
      api
        .request<{ journey: Journey }>(`/routes/${routeId}/journey`, {
          auth: true,
        })
        .then((response) => response.journey),
  });

  // Every change answers with the whole updated journey: just show it.
  function show(next: Journey) {
    queryClient.setQueryData(queryKey, next);
    void queryClient.invalidateQueries({ queryKey: ['journeys'] });
  }
  // A 409 means this screen was out of date (another device closed the film,
  // or the route was left): look at the real state again.
  function refreshIfStale(error: unknown) {
    if (error instanceof ApiError && error.status === 409) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }

  const post = <T,>(path: string, body?: unknown) =>
    api.request<T>(`/routes/${routeId}/journey/${path}`, {
      method: 'POST',
      auth: true,
      body,
    });

  const start = useMutation({
    mutationFn: (stepId: string) =>
      post<{ journey: Journey }>(`steps/${stepId}/start`),
    onSuccess: (response) => show(response.journey),
    onError: refreshIfStale,
  });
  const close = useMutation({
    mutationFn: (input: { stepId: string; body: CloseStepBody }) =>
      post<{ journey: Journey }>(`steps/${input.stepId}/close`, input.body),
    onSuccess: (response) => {
      show(response.journey);
      setClosing(null);
    },
    onError: refreshIfStale,
  });
  const leave = useMutation({
    mutationFn: () => post<undefined>('leave'),
    onSuccess: () => {
      // Mark it out of date without refetching a screen we are leaving: coming
      // back later loads the real state instead of the cached "active" one.
      void queryClient.invalidateQueries({ queryKey, refetchType: 'none' });
      void queryClient.invalidateQueries({ queryKey: ['journeys'] });
      void navigate('/journeys');
    },
    onError: refreshIfStale,
  });

  const busy = start.isPending || close.isPending || leave.isPending;
  const resetErrors = () => {
    start.reset();
    close.reset();
    leave.reset();
  };

  const back = (
    <Link className="back-link" to="/journeys">
      <Icon name="back" size={18} />
      {t('journey.back')}
    </Link>
  );

  if (journey.isPending) {
    return (
      <div className="page">
        {back}
        <p className="note" role="status">
          {t('common.loading')}
        </p>
      </div>
    );
  }
  if (journey.isError) {
    return (
      <div className="page narrow">
        {back}
        <ErrorBox
          message={errorMessage(t, journey.error)}
          onRetry={() => void journey.refetch()}
        />
      </div>
    );
  }

  const { route, enrollment, steps } = journey.data;
  const following = enrollment.status !== 'abandoned';
  const closingStep = closing
    ? steps.find((step) => step.id === closing.stepId)
    : undefined;
  const actionError = start.isError || leave.isError;

  return (
    <div className="page">
      {back}
      <div className="journey-layout">
        <aside className="journey-side">
          <div className="card card-pad">
            <h1>{route.title}</h1>
            <div className="author" style={{ marginTop: 0 }}>
              <Avatar name={route.author} />
              <span>{t('journey.by', { author: route.author })}</span>
            </div>
            {route.description && <p>{route.description}</p>}
            <ProgressBar
              closed={enrollment.closedSteps}
              total={enrollment.stepCount}
              label={t('journey.progress', {
                closed: enrollment.closedSteps,
                total: enrollment.stepCount,
              })}
            />
            <p className="note">{t('journey.orderIsAdvice')}</p>
          </div>
          {enrollment.status === 'completed' && (
            <div className="banner banner-success">
              <Icon name="check" />
              <div>{t('journey.completed')}</div>
            </div>
          )}
          {enrollment.status === 'abandoned' && (
            <div className="banner banner-info">
              <Icon name="info" />
              <div>{t('journey.abandoned')}</div>
            </div>
          )}
        </aside>

        <div>
          {actionError && (
            <p
              className="form-error"
              role="alert"
              style={{ marginBottom: 'var(--sp-3)' }}
            >
              {errorMessage(t, start.error ?? leave.error)}
            </p>
          )}

          <ol className="steps">
            {steps.map((step) => (
              <StepItem
                key={step.id}
                step={step}
                author={route.author}
                following={following}
                busy={busy}
                onStart={() => {
                  resetErrors();
                  start.mutate(step.id);
                }}
                onOpenClose={(seenBefore) => {
                  resetErrors();
                  setClosing({ stepId: step.id, seenBefore });
                }}
              />
            ))}
          </ol>

          {enrollment.status === 'active' && (
            <div style={{ marginTop: 'var(--sp-6)' }}>
              {confirmingLeave ? (
                <div className="actions" style={{ alignItems: 'center' }}>
                  <span className="note">{t('journey.leaveAsk')}</span>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={busy}
                    onClick={() => {
                      resetErrors();
                      leave.mutate();
                    }}
                  >
                    {t('journey.leaveConfirm')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => setConfirmingLeave(false)}
                  >
                    {t('journey.cancel')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--text-muted)' }}
                  disabled={busy}
                  onClick={() => setConfirmingLeave(true)}
                >
                  {t('journey.leave')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {closing && closingStep && (
        <CloseDialog
          step={closingStep}
          total={enrollment.stepCount}
          author={route.author}
          initialSeenBefore={closing.seenBefore}
          pending={close.isPending}
          error={close.isError ? errorMessage(t, close.error) : null}
          onSubmit={(body) => close.mutate({ stepId: closingStep.id, body })}
          onCancel={() => {
            close.reset();
            setClosing(null);
          }}
        />
      )}
    </div>
  );
}

type StepItemProps = {
  step: JourneyStep;
  author: string;
  following: boolean;
  busy: boolean;
  onStart: () => void;
  onOpenClose: (seenBefore: boolean) => void;
};

function StepItem({
  step,
  author,
  following,
  busy,
  onStart,
  onOpenClose,
}: StepItemProps) {
  const { t } = useTranslation();
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

  return (
    <li
      className="step"
      data-state={step.state}
      data-next={step.recommendedNext}
    >
      <span className="num">{step.position}</span>
      <Poster url={step.film.posterUrl} />
      <div className="body">
        <div className="main">
          <div className="head">
            <h2>
              {step.film.title}
              {step.film.releaseYear !== null && (
                <>
                  {' '}
                  <span className="year">{step.film.releaseYear}</span>
                </>
              )}
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
                    <span
                      className={`vs${comparison === 'same' ? ' same' : ''}`}
                    >
                      {t(`journey.${comparison}`)}
                    </span>
                    <div>
                      <span className="who">{author}</span>
                      <EmotionBadge emotion={step.authorEmotion} />
                    </div>
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
              <p className="note-text">
                <span className="note-label">
                  {t('journey.noteAfter', { author })}
                </span>
                <q>{step.noteAfter}</q>
              </p>
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
    </li>
  );
}

/** Content that opens later: shown as deliberately locked, not as missing. */
function Locked({ text }: { text: string }) {
  return (
    <div className="locked">
      <Icon name="lock" size={18} />
      <span>{text}</span>
    </div>
  );
}
