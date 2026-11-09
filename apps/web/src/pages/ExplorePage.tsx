import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { api } from '../api/instance.js';
import type { PublicRoutesPage } from '../api/types.js';
import { errorMessage } from '../components/errorMessage.js';

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
    <section>
      <h1>{t('explore.title')}</h1>
      <div>
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

      {routes.isPending && <p>{t('common.loading')}</p>}
      {routes.isError && (
        <p role="alert">
          {errorMessage(t, routes.error)}{' '}
          <button type="button" onClick={() => void routes.refetch()}>
            {t('common.retry')}
          </button>
        </p>
      )}
      {routes.data?.routes.length === 0 && <p>{t('explore.empty')}</p>}
      <ul>
        {routes.data?.routes.map((route) => (
          <li key={route.id}>
            <Link to={`/routes/${route.id}`}>{route.title}</Link> —{' '}
            {t('explore.by', { author: route.author })} ·{' '}
            {t('explore.films', { count: route.stepCount })} ·{' '}
            {t('explore.completions', { count: route.completions })} ·{' '}
            {route.rating.average === null
              ? t('explore.notEnoughVotes')
              : t('explore.rating', {
                  average: route.rating.average.toFixed(1),
                  votes: route.rating.votes,
                })}
          </li>
        ))}
      </ul>
    </section>
  );
}
