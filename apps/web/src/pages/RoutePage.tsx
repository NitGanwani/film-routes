import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api/instance.js';
import type { JoinResult, PublicRouteDetail } from '../api/types.js';
import { Avatar } from '../components/Avatar.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon } from '../components/Icon.js';
import { LanguageTag } from '../components/LanguageTag.js';
import { Poster } from '../components/Poster.js';
import { ErrorBox } from '../components/States.js';
import { filmTitle, originalTitleNote } from '../films/titles.js';
import { formatAverage } from '../i18n/format.js';
import { loginPathFor } from '../session/nextPath.js';
import { useSession } from '../session/SessionProvider.js';

/** What anyone sees of a public route: its films, none of the notes. */
export function RoutePage() {
  const { t, i18n } = useTranslation();
  const { routeId = '' } = useParams();
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const route = useQuery({
    queryKey: ['public-route', routeId],
    queryFn: () =>
      api
        .request<{ route: PublicRouteDetail }>(`/public/routes/${routeId}`)
        .then((response) => response.route),
  });

  const join = useMutation({
    mutationFn: () =>
      api.request<JoinResult>(`/public/routes/${routeId}/join`, {
        method: 'POST',
        auth: true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['journeys'] });
      void navigate(`/journeys/${routeId}`);
    },
  });

  const back = (
    <Link className="back-link" to="/">
      <Icon name="back" size={18} />
      {t('nav.explore')}
    </Link>
  );

  if (route.isPending) {
    return (
      <div className="page narrow">
        {back}
        <p className="note" role="status">
          {t('common.loading')}
        </p>
      </div>
    );
  }
  if (route.isError) {
    return (
      <div className="page narrow">
        {back}
        <ErrorBox
          message={errorMessage(t, route.error)}
          onRetry={() => void route.refetch()}
        />
      </div>
    );
  }

  const data = route.data;
  const isAuthor =
    session.status === 'authenticated' && session.user.username === data.author;

  return (
    <div className="page narrow">
      {back}
      <header className="route-head">
        <h1>{data.title}</h1>
        <div className="author">
          <Avatar name={data.author} />
          <span>
            {t('route.by', { author: data.author })} · {data.stepCount}{' '}
            {t('explore.filmsLabel', { count: data.stepCount })}
          </span>
          <LanguageTag locale={data.locale} />
        </div>
        {data.description && (
          <p style={{ marginTop: 'var(--sp-3)' }}>{data.description}</p>
        )}
        <div className="stats-line">
          {data.rating.average === null ? (
            <span>{t('explore.notEnoughVotes')}</span>
          ) : (
            <span>
              <b>{formatAverage(data.rating.average, i18n.language)}</b>
              {t('route.ratingOf', { count: data.rating.votes })}
            </span>
          )}
          <span>
            <b>{data.completions}</b>
            {t('explore.completionsLabel', { count: data.completions })}
          </span>
        </div>
      </header>

      <div className="card card-pad">
        <h2 className="visually-hidden">{t('route.films')}</h2>
        <ol className="film-rows">
          {data.steps.map((step) => {
            const shown = filmTitle(step.film, i18n.language);
            const original = originalTitleNote(step.film, shown);
            return (
              <li key={step.position} className="film-row">
                <span className="n">{step.position}</span>
                <Poster url={step.film.posterUrl} />
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
              </li>
            );
          })}
        </ol>
      </div>
      <p className="note" style={{ marginTop: 'var(--sp-3)' }}>
        {t('route.spoilerFree', { author: data.author })}
      </p>

      <div className="sticky-cta">
        {isAuthor ? (
          <p className="note">{t('route.own')}</p>
        ) : session.status === 'anonymous' ? (
          <Link
            className="btn btn-primary btn-block"
            to={loginPathFor(`/routes/${routeId}`)}
          >
            {t('route.loginToJoin')}
          </Link>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={join.isPending || session.status === 'loading'}
              onClick={() => join.mutate()}
            >
              {join.isPending ? t('route.joining') : t('route.join')}
            </button>
            {join.isError && (
              <p className="form-error" role="alert">
                {errorMessage(t, join.error)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
