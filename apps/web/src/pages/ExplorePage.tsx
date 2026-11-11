import { RATING } from '@film-routes/shared';
import { useQuery } from '@tanstack/react-query';
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { api } from '../api/instance.js';
import type { PublicRouteSummary, PublicRoutesPage } from '../api/types.js';
import { errorMessage } from '../components/errorMessage.js';
import { LanguageTag } from '../components/LanguageTag.js';
import { RouteCard } from '../components/RouteCard.js';
import {
  EmptyState,
  ErrorBox,
  RouteListSkeleton,
} from '../components/States.js';
import { formatAverage } from '../i18n/format.js';
import { useSession } from '../session/SessionProvider.js';

const SORTS = ['new', 'popular', 'top'] as const;
type Sort = (typeof SORTS)[number];
const SORT_LABELS = {
  new: 'explore.sortNew',
  popular: 'explore.sortPopular',
  top: 'explore.sortTop',
} as const;

export function ExplorePage() {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const [sort, setSort] = useState<Sort>('new');
  // By default only routes written in the language of the page; the person can
  // widen it. Their own language is the one they can actually read.
  const [allLanguages, setAllLanguages] = useState(false);
  const language = i18n.language === 'en' ? 'en' : 'es';
  const filter = allLanguages ? 'all' : language;
  const routes = useQuery({
    queryKey: ['public-routes', sort, filter],
    queryFn: () =>
      api.request<PublicRoutesPage>(
        `/public/routes?sort=${sort}${allLanguages ? '' : `&locale=${language}`}`,
      ),
  });

  return (
    <div className="page">
      {session.status === 'anonymous' && (
        <section className="hero">
          <h2>{t('home.welcomeTitle')}</h2>
          <p>{t('home.welcomeText')}</p>
          <div className="actions">
            <Link className="btn btn-primary" to="/register">
              {t('nav.register')}
            </Link>
            <Link className="btn btn-ghost" to="/login">
              {t('nav.login')}
            </Link>
            <Link className="btn btn-ghost" to="/welcome">
              {t('nav.howItWorks')}
            </Link>
          </div>
        </section>
      )}
      <div className="page-head">
        <div>
          <h1>{t('explore.title')}</h1>
          <p className="note">{t('explore.subtitle')}</p>
        </div>
        {/* A segmented control: the indicator slides to the chosen option. */}
        <div
          className="tabs"
          role="group"
          aria-label={t('explore.sortLabel')}
          style={{ '--i': SORTS.indexOf(sort) } as CSSProperties}
        >
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
      <label className="check-line">
        <input
          type="checkbox"
          checked={allLanguages}
          onChange={(event) => setAllLanguages(event.target.checked)}
        />
        {t('explore.allLanguages')}
      </label>

      {routes.isPending && <RouteListSkeleton />}
      {routes.isError && (
        <ErrorBox
          message={errorMessage(t, routes.error)}
          onRetry={() => void routes.refetch()}
        />
      )}
      {routes.data?.routes.length === 0 &&
        (allLanguages ? (
          <EmptyState
            title={t('explore.empty')}
            text={t('explore.emptyText')}
          />
        ) : (
          <EmptyState
            title={t('explore.emptyLanguage', {
              language: t(`languages.${language}`),
            })}
            text={t('explore.emptyLanguageText')}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAllLanguages(true)}
            >
              {t('explore.showAll')}
            </button>
          </EmptyState>
        ))}
      {routes.data && routes.data.routes.length > 0 && (
        <ul className="route-list grid">
          {routes.data.routes.map((route, index) => (
            <ExploreCard
              key={route.id}
              route={route}
              // In "Popular" the first route is the big one.
              featured={sort === 'popular' && index === 0}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ExploreCard({
  route,
  featured,
}: {
  route: PublicRouteSummary;
  featured: boolean;
}) {
  const { t, i18n } = useTranslation();
  return (
    <RouteCard
      to={`/routes/${route.id}`}
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
