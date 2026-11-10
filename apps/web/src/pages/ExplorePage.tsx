import { RATING } from '@film-routes/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/instance.js';
import type { PublicRouteSummary, PublicRoutesPage } from '../api/types.js';
import { errorMessage } from '../components/errorMessage.js';
import { RouteCard } from '../components/RouteCard.js';
import {
  EmptyState,
  ErrorBox,
  RouteListSkeleton,
} from '../components/States.js';
import { formatAverage } from '../i18n/format.js';

const SORTS = ['new', 'popular', 'top'] as const;
type Sort = (typeof SORTS)[number];
const SORT_LABELS = {
  new: 'explore.sortNew',
  popular: 'explore.sortPopular',
  top: 'explore.sortTop',
} as const;

export function ExplorePage() {
  const { t } = useTranslation();
  const [sort, setSort] = useState<Sort>('new');
  const routes = useQuery({
    queryKey: ['public-routes', sort],
    queryFn: () => api.request<PublicRoutesPage>(`/public/routes?sort=${sort}`),
  });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t('explore.title')}</h1>
          <p className="note">{t('explore.subtitle')}</p>
        </div>
        <div className="tabs" role="group" aria-label={t('explore.sortLabel')}>
          {SORTS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={sort === option}
              onClick={() => setSort(option)}
            >
              {t(SORT_LABELS[option])}
            </button>
          ))}
        </div>
      </div>

      {routes.isPending && <RouteListSkeleton />}
      {routes.isError && (
        <ErrorBox
          message={errorMessage(t, routes.error)}
          onRetry={() => void routes.refetch()}
        />
      )}
      {routes.data?.routes.length === 0 && (
        <EmptyState title={t('explore.empty')} text={t('explore.emptyText')} />
      )}
      {routes.data && routes.data.routes.length > 0 && (
        <ul className="route-list grid">
          {routes.data.routes.map((route) => (
            <ExploreCard key={route.id} route={route} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ExploreCard({ route }: { route: PublicRouteSummary }) {
  const { t, i18n } = useTranslation();
  return (
    <RouteCard
      to={`/routes/${route.id}`}
      title={route.title}
      by={t('route.by', { author: route.author })}
      posters={route.posters}
    >
      <p className="stats">
        <span>
          <b>{route.stepCount}</b>{' '}
          {t('explore.filmsLabel', { count: route.stepCount })}
        </span>
        {route.rating.average === null ? (
          <span className="few">{t('explore.notEnoughVotes')}</span>
        ) : (
          <span className="rating">
            <b>{formatAverage(route.rating.average, i18n.language)}</b>/
            {RATING.max}
          </span>
        )}
        <span>
          <b>{route.completions}</b>{' '}
          {t('explore.completionsLabel', { count: route.completions })}
        </span>
      </p>
    </RouteCard>
  );
}
