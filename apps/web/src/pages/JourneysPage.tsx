import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { api } from '../api/instance.js';
import type { JourneySummary } from '../api/types.js';
import { errorMessage } from '../components/errorMessage.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { LanguageTag } from '../components/LanguageTag.js';
import { journeyQuery } from '../api/queries.js';
import { RouteCard } from '../components/RouteCard.js';
import {
  EmptyState,
  ErrorBox,
  RouteListSkeleton,
} from '../components/States.js';

/** The routes this person follows, and how far along they are. */
export function JourneysPage() {
  const { t } = useTranslation();
  const journeys = useQuery({
    queryKey: ['journeys'],
    queryFn: () =>
      api
        .request<{ journeys: JourneySummary[] }>('/journeys', { auth: true })
        .then((response) => response.journeys),
  });

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('journeys.title')}</h1>
      </div>

      {journeys.isPending && <RouteListSkeleton rows={2} />}
      {journeys.isError && (
        <ErrorBox
          message={errorMessage(t, journeys.error)}
          onRetry={() => void journeys.refetch()}
        />
      )}
      {journeys.data?.length === 0 && (
        <EmptyState title={t('journeys.empty')} text={t('journeys.emptyText')}>
          <Link className="btn btn-secondary btn-sm" to="/explore">
            {t('journeys.exploreCta')}
          </Link>
        </EmptyState>
      )}
      {journeys.data && journeys.data.length > 0 && (
        <ul className="route-list grid">
          {journeys.data.map((journey) => (
            <JourneyCard key={journey.enrollmentId} journey={journey} />
          ))}
        </ul>
      )}
    </div>
  );
}

function JourneyCard({ journey }: { journey: JourneySummary }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { route } = journey;
  const badges = (
    <>
      <LanguageTag locale={route.locale} />
      {route.hidden && (
        <span className="badge badge-hidden">{t('journeys.hidden')}</span>
      )}
      {journey.status === 'completed' && (
        <span className="badge badge-ok">{t('journeys.completed')}</span>
      )}
      {journey.status === 'abandoned' && (
        <span className="badge">{t('journeys.abandoned')}</span>
      )}
    </>
  );

  return (
    <RouteCard
      // A hidden route cannot be opened until an admin lifts it.
      to={route.hidden ? null : `/journeys/${route.id}`}
      transitionId={route.hidden ? null : route.id}
      // Load the journey a moment early, so it is ready when the card travels to it.
      onIntent={() =>
        route.hidden
          ? undefined
          : void queryClient.prefetchQuery(journeyQuery(route.id))
      }
      title={route.title}
      by={t('route.by', { author: route.author })}
      posters={route.posters}
      cover={route.coverUrl}
      badges={badges}
    >
      <ProgressBar
        closed={journey.closedSteps}
        total={route.stepCount}
        label={t('journeys.progress', {
          closed: journey.closedSteps,
          total: route.stepCount,
        })}
      />
    </RouteCard>
  );
}
