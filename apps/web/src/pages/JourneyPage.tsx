import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client.js';
import { api } from '../api/instance.js';
import type { CloseStepBody, Journey, JourneyStep } from '../api/types.js';
import { EmotionBadge } from '../components/EmotionBadge.js';
import { errorMessage } from '../components/errorMessage.js';
import { CloseStepForm } from '../journey/CloseStepForm.js';
import {
  compareEmotions,
  filmLabel,
  progressPercent,
  stepActions,
} from '../journey/model.js';

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

  if (journey.isPending) return <p>{t('common.loading')}</p>;
  if (journey.isError) {
    return (
      <p role="alert">
        {errorMessage(t, journey.error)}{' '}
        <button type="button" onClick={() => void journey.refetch()}>
          {t('common.retry')}
        </button>{' '}
        <Link to="/journeys">{t('nav.journeys')}</Link>
      </p>
    );
  }

  const { route, enrollment, steps } = journey.data;
  const following = enrollment.status !== 'abandoned';
  const authorName = route.author;

  return (
    <article>
      <p>
        <Link to="/journeys">{t('nav.journeys')}</Link>
      </p>
      <h1>{route.title}</h1>
      <p>{t('journey.by', { author: authorName })}</p>
      {route.description && <p>{route.description}</p>}

      <progress
        value={progressPercent(enrollment.closedSteps, enrollment.stepCount)}
        max={100}
      />
      <p>
        {t('journey.progress', {
          closed: enrollment.closedSteps,
          total: enrollment.stepCount,
        })}
      </p>
      {enrollment.status === 'completed' && <p>{t('journey.completed')}</p>}
      {enrollment.status === 'abandoned' && <p>{t('journey.abandoned')}</p>}

      {(start.isError || leave.isError) && (
        <p role="alert">{errorMessage(t, start.error ?? leave.error)}</p>
      )}

      <ol>
        {steps.map((step) => (
          <StepItem
            key={step.id}
            step={step}
            author={authorName}
            following={following}
            busy={busy}
            closing={closing?.stepId === step.id ? closing : null}
            closePending={close.isPending}
            closeError={close.isError ? errorMessage(t, close.error) : null}
            onStart={() => {
              resetErrors();
              start.mutate(step.id);
            }}
            onOpenClose={(seenBefore) => {
              resetErrors();
              setClosing({ stepId: step.id, seenBefore });
            }}
            onCancelClose={() => {
              close.reset();
              setClosing(null);
            }}
            onSubmitClose={(body) => close.mutate({ stepId: step.id, body })}
          />
        ))}
      </ol>

      {enrollment.status === 'active' &&
        (confirmingLeave ? (
          <p>
            {t('journey.leaveAsk')}{' '}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                resetErrors();
                leave.mutate();
              }}
            >
              {t('journey.leaveConfirm')}
            </button>{' '}
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmingLeave(false)}
            >
              {t('journey.cancel')}
            </button>
          </p>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmingLeave(true)}
          >
            {t('journey.leave')}
          </button>
        ))}
    </article>
  );
}

type StepItemProps = {
  step: JourneyStep;
  author: string;
  following: boolean;
  busy: boolean;
  closing: Closing | null;
  closePending: boolean;
  closeError: string | null;
  onStart: () => void;
  onOpenClose: (seenBefore: boolean) => void;
  onCancelClose: () => void;
  onSubmitClose: (body: CloseStepBody) => void;
};

function StepItem({
  step,
  author,
  following,
  busy,
  closing,
  closePending,
  closeError,
  onStart,
  onOpenClose,
  onCancelClose,
  onSubmitClose,
}: StepItemProps) {
  const { t } = useTranslation();
  const actions = stepActions(step, following);
  const stateLabel =
    step.state === 'closed'
      ? t('journey.stateClosed')
      : step.state === 'started'
        ? t('journey.stateStarted')
        : step.recommendedNext
          ? t('journey.stateNext')
          : t('journey.statePending');
  const comparison = compareEmotions(step.myEmotion, step.authorEmotion);

  return (
    <li data-state={step.state} data-next={step.recommendedNext}>
      <h2>{filmLabel(step.film)}</h2>
      <p>{stateLabel}</p>

      {step.noteBeforeLocked ? (
        <p>{t('journey.noteBeforeLocked')}</p>
      ) : (
        step.noteBefore && (
          <p>
            <strong>{t('journey.noteBefore')}</strong> {step.noteBefore}
          </p>
        )
      )}

      {step.state === 'closed' ? (
        <>
          {step.myEmotion && (
            <p>
              {t('journey.you')}: <EmotionBadge emotion={step.myEmotion} />
              {step.authorEmotion && (
                <>
                  {' · '}
                  {author}: <EmotionBadge emotion={step.authorEmotion} />
                  {comparison && <> ({t(`journey.${comparison}`)})</>}
                </>
              )}
            </p>
          )}
          {step.myComment && <p>{step.myComment}</p>}
          {step.noteAfter && (
            <p>
              <strong>{t('journey.noteAfter', { author })}</strong>{' '}
              {step.noteAfter}
            </p>
          )}
        </>
      ) : (
        <p>{t('journey.noteAfterLocked', { author })}</p>
      )}

      {closing ? (
        <CloseStepForm
          step={step}
          author={author}
          initialSeenBefore={closing.seenBefore}
          pending={closePending}
          error={closeError}
          onSubmit={onSubmitClose}
          onCancel={onCancelClose}
        />
      ) : (
        <p>
          {actions.start && (
            <button type="button" disabled={busy} onClick={onStart}>
              {t('journey.start')}
            </button>
          )}{' '}
          {actions.closeWatched && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpenClose(false)}
            >
              {t('journey.closeWatched')}
            </button>
          )}{' '}
          {actions.closeSeen && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpenClose(true)}
            >
              {t('journey.closeSeen')}
            </button>
          )}
        </p>
      )}
    </li>
  );
}
