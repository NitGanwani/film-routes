import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMyRoutes } from '../api/queries.js';
import type { AuthorRouteSummary } from '../api/types.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon } from '../components/Icon.js';
import { LanguageTag } from '../components/LanguageTag.js';
import { RouteCard } from '../components/RouteCard.js';
import {
  EmptyState,
  ErrorBox,
  RouteListSkeleton,
} from '../components/States.js';
import { missingFilms, VISIBILITY_ICON } from '../myRoutes/model.js';

/** The routes this person has written, and what state each one is in. */
export function MyRoutesPage() {
  const { t } = useTranslation();
  const routes = useMyRoutes();
  const isEmpty = routes.data?.length === 0;

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('myRoutes.title')}</h1>
        {/* An empty list already has its own button: two would be one too many. */}
        {!isEmpty && (
          <Link className="btn btn-primary head-create" to="/my-routes/new">
            {t('myRoutes.create')}
          </Link>
        )}
      </div>

      {routes.isPending && <RouteListSkeleton />}
      {routes.isError && (
        <ErrorBox
          message={errorMessage(t, routes.error)}
          onRetry={() => void routes.refetch()}
        />
      )}
      {isEmpty && (
        <EmptyState
          strip
          title={t('myRoutes.empty.title')}
          text={t('myRoutes.empty.body')}
        >
          <Link className="btn btn-primary" to="/my-routes/new">
            {t('myRoutes.create')}
          </Link>
        </EmptyState>
      )}
      {routes.data && routes.data.length > 0 && (
        <ul className="route-list grid fade-in">
          {routes.data.map((route) => (
            <MyRouteCard key={route.id} route={route} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One of my routes. The list has no pictures (the author's list does not carry
 * them), so the top of the card is a quiet amber glow with the number of films.
 */
function MyRouteCard({ route }: { route: AuthorRouteSummary }) {
  const { t } = useTranslation();
  const missing = missingFilms(route.stepCount);
  return (
    <RouteCard
      to={`/my-routes/${route.id}`}
      title={route.title}
      posters={[]}
      placeholder={
        <span className="route-card-count">
          <b>{route.stepCount}</b>
          <span>{t('myRoutes.films', { count: route.stepCount })}</span>
        </span>
      }
      badges={
        <>
          <LanguageTag locale={route.locale} />
          <span className="badge">
            <Icon name={VISIBILITY_ICON[route.visibility]} size={14} />
            {t(`myRoutes.visibility.${route.visibility}`)}
          </span>
          {route.locked && (
            <span className="badge" title={t('myRoutes.lockedHint')}>
              <Icon name="lock" size={14} />
              {t('myRoutes.locked')}
              <span className="visually-hidden">
                . {t('myRoutes.lockedHint')}
              </span>
            </span>
          )}
          {missing > 0 && (
            <span className="badge badge-warn">
              <Icon name="alert" size={14} />
              {t('myRoutes.incomplete', { count: missing })}
            </span>
          )}
        </>
      }
    >
      {route.hidden && (
        <p className="route-notice">
          <Icon name="alert" size={16} />
          {t('myRoutes.hidden')}
        </p>
      )}
      <p className="stats">
        <span>
          <b>{route.stepCount}</b>{' '}
          {t('myRoutes.films', { count: route.stepCount })}
        </span>
      </p>
    </RouteCard>
  );
}
