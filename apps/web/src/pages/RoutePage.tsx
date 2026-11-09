import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api/instance.js';
import type { JoinResult, PublicRouteDetail } from '../api/types.js';
import { errorMessage } from '../components/errorMessage.js';
import { filmLabel } from '../journey/model.js';
import { loginPathFor } from '../session/nextPath.js';
import { useSession } from '../session/SessionProvider.js';

/** What anyone sees of a public route: its films, none of the notes. */
export function RoutePage() {
  const { t } = useTranslation();
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

  if (route.isPending) return <p>{t('common.loading')}</p>;
  if (route.isError) {
    return (
      <p role="alert">
        {errorMessage(t, route.error)}{' '}
        <button type="button" onClick={() => void route.refetch()}>
          {t('common.retry')}
        </button>
      </p>
    );
  }

  const data = route.data;
  const isAuthor =
    session.status === 'authenticated' && session.user.username === data.author;

  return (
    <article>
      <h1>{data.title}</h1>
      <p>{t('route.by', { author: data.author })}</p>
      {data.description && <p>{data.description}</p>}
      <p>
        {t('route.stats', {
          films: data.stepCount,
          completions: data.completions,
        })}
        {' · '}
        {data.rating.average === null
          ? t('explore.notEnoughVotes')
          : t('explore.rating', {
              average: data.rating.average.toFixed(1),
              votes: data.rating.votes,
            })}
      </p>

      <h2>{t('route.films')}</h2>
      <ol>
        {data.steps.map((step) => (
          <li key={step.position}>{filmLabel(step.film)}</li>
        ))}
      </ol>
      <p>{t('route.spoilerFree', { author: data.author })}</p>

      {isAuthor ? (
        <p>{t('route.own')}</p>
      ) : session.status === 'anonymous' ? (
        <Link to={loginPathFor(`/routes/${routeId}`)}>
          {t('route.loginToJoin')}
        </Link>
      ) : (
        <>
          <button
            type="button"
            disabled={join.isPending || session.status === 'loading'}
            onClick={() => join.mutate()}
          >
            {join.isPending ? t('route.joining') : t('route.join')}
          </button>
          {join.isError && <p role="alert">{errorMessage(t, join.error)}</p>}
        </>
      )}
    </article>
  );
}
