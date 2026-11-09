import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { api } from '../api/instance.js';
import type { JourneySummary } from '../api/types.js';
import { errorMessage } from '../components/errorMessage.js';

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
    <section>
      <h1>{t('journeys.title')}</h1>

      {journeys.isPending && <p>{t('common.loading')}</p>}
      {journeys.isError && (
        <p role="alert">
          {errorMessage(t, journeys.error)}{' '}
          <button type="button" onClick={() => void journeys.refetch()}>
            {t('common.retry')}
          </button>
        </p>
      )}
      {journeys.data?.length === 0 && <p>{t('journeys.empty')}</p>}
      <ul>
        {journeys.data?.map((journey) => (
          <li key={journey.enrollmentId}>
            {journey.route.hidden ? (
              <strong>{journey.route.title}</strong>
            ) : (
              <Link to={`/journeys/${journey.route.id}`}>
                {journey.route.title}
              </Link>
            )}{' '}
            — {t('route.by', { author: journey.route.author })} ·{' '}
            {t('journeys.progress', {
              closed: journey.closedSteps,
              total: journey.route.stepCount,
            })}
            {journey.route.hidden && <> · {t('journeys.hidden')}</>}
            {journey.status === 'completed' && (
              <> · {t('journeys.completed')}</>
            )}
            {journey.status === 'abandoned' && (
              <> · {t('journeys.abandoned')}</>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
