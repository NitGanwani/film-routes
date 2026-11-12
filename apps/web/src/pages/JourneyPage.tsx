import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client.js';
import { journeyQuery } from '../api/queries.js';
import { api } from '../api/instance.js';
import type { CloseStepBody, Journey } from '../api/types.js';
import { Avatar } from '../components/Avatar.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon } from '../components/Icon.js';
import { Shared } from '../components/Shared.js';
import { FilmStrip } from '../components/FilmStrip.js';
import { ErrorBox } from '../components/States.js';
import { CloseDialog } from '../journey/CloseDialog.js';
import { StepItem } from '../journey/StepItem.js';

type Closing = { stepId: string; seenBefore: boolean };

/** One traveler's view of a route: the films, what has opened, what has not. */
export function JourneyPage() {
  const { t } = useTranslation();
  const { routeId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { queryKey } = journeyQuery(routeId);
  // What the route's card in "My journeys" sends here: its title and the poster
  // of the first film, which is the first one on this page.
  const titleName = `title-${routeId}`;
  const posterName = `poster-${routeId}`;

  const [closing, setClosing] = useState<Closing | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  const journey = useQuery(journeyQuery(routeId));

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
      <div className="page" aria-busy="true">
        {back}
        {/* The title's placeholder has the title's name, so the card's title
            still travels here while the journey loads. */}
        <div className="journey-layout">
          <aside className="journey-side">
            <div className="card card-pad" aria-hidden="true">
              <Shared name={titleName} kind="title">
                <div className="skel title" />
              </Shared>
              <div
                className="skel line"
                style={{ width: '55%', marginTop: 'var(--sp-3)' }}
              />
              <div
                className="skel line"
                style={{ width: '80%', marginTop: 'var(--sp-2)' }}
              />
            </div>
          </aside>
        </div>
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
  const progressLabel = t('journey.progress', {
    closed: enrollment.closedSteps,
    total: enrollment.stepCount,
  });
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
            <Shared name={titleName} kind="title">
              <h1>{route.title}</h1>
            </Shared>
            <div className="author" style={{ marginTop: 0 }}>
              <Avatar name={route.author} />
              <span>{t('journey.by', { author: route.author })}</span>
            </div>
            {route.description && <p>{route.description}</p>}
            <div className="progress">
              <FilmStrip
                frames={steps.map((step) => ({
                  state: step.state,
                  posterUrl: step.film.posterUrl,
                }))}
                label={progressLabel}
              />
              {/* The strip already says it to a screen reader. */}
              <span aria-hidden="true">{progressLabel}</span>
            </div>
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
            {steps.map((step, index) => (
              <StepItem
                key={step.id}
                step={step}
                transitionName={index === 0 ? posterName : null}
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

      {/* AnimatePresence keeps the sheet on screen while it slides away. */}
      <AnimatePresence>
        {closing && closingStep && (
          <CloseDialog
            key={closing.stepId}
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
      </AnimatePresence>
    </div>
  );
}
