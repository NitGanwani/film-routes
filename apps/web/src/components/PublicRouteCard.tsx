import { RATING } from '@film-routes/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { publicRouteQuery } from '../api/queries.js';
import type { PublicRouteSummary } from '../api/types.js';
import { formatAverage } from '../i18n/format.js';
import { LanguageTag } from './LanguageTag.js';
import { RouteCard } from './RouteCard.js';

/** A public route as a card (Explore and the landing page), with its stats. */
export function PublicRouteCard({
  route,
  featured = false,
}: {
  route: PublicRouteSummary;
  featured?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  return (
    <RouteCard
      to={`/routes/${route.id}`}
      transitionId={route.id}
      // Load the page a moment early, so it is ready when the card travels to it.
      onIntent={() =>
        void queryClient.prefetchQuery(publicRouteQuery(route.id))
      }
      title={route.title}
      by={t('route.by', { author: route.author })}
      posters={route.posters}
      cover={route.coverUrl}
      featured={featured}
      badges={<LanguageTag locale={route.locale} />}
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
