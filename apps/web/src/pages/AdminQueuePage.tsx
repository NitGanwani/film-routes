import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { adminQueueQuery } from '../api/queries.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon } from '../components/Icon.js';
import {
  EmptyState,
  ErrorBox,
  RouteListSkeleton,
} from '../components/States.js';
import { formatDay } from '../editor/invites.js';
import { pageCount, reasonCounts } from '../moderation/admin.js';
import { REASON_ICON } from '../moderation/report.js';

/** `?page=` as a whole number from 1; anything else is the first page. */
function pageFrom(params: URLSearchParams): number {
  const page = Number(params.get('page'));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * The moderators' queue: the routes people have reported and nobody has
 * judged yet, the most reported first. Several reports on one route are one
 * decision to make, so each route appears once.
 */
export function AdminQueuePage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const page = pageFrom(params);
  const queue = useQuery({
    ...adminQueueQuery(page),
    // The previous page stays until the next one arrives: no flicker.
    placeholderData: (previous) => previous,
  });
  const now = new Date();

  const pages = queue.data
    ? pageCount(queue.data.total, queue.data.pageSize)
    : 1;
  const goTo = (next: number) => {
    setParams(next === 1 ? {} : { page: String(next) });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t('admin.queue.title')}</h1>
          <p className="note">{t('admin.queue.intro')}</p>
        </div>
      </div>

      {queue.isPending && <RouteListSkeleton />}
      {queue.isError && (
        <ErrorBox
          message={errorMessage(t, queue.error)}
          onRetry={() => void queue.refetch()}
        />
      )}
      {queue.data && queue.data.routes.length === 0 && (
        <EmptyState
          icon="check"
          title={t('admin.queue.empty.title')}
          text={t('admin.queue.empty.body')}
        />
      )}
      {queue.data && queue.data.routes.length > 0 && (
        <>
          <p className="note" role="status">
            {t('admin.queue.count', { count: queue.data.total })}
          </p>
          <ul className="admin-list">
            {queue.data.routes.map((entry) => (
              <li key={entry.routeId} className="card admin-item">
                <div className="admin-item-main">
                  <h2>{entry.title}</h2>
                  <p className="note">
                    {t('admin.by', { author: entry.author })}
                    {' · '}
                    {t('admin.queue.reports', { count: entry.openReports })}
                  </p>
                  <ul className="admin-reasons">
                    {reasonCounts(entry.byReason).map(({ reason, count }) => (
                      <li key={reason} className="chip">
                        <Icon name={REASON_ICON[reason]} size={16} />
                        {t(`report.reasons.${reason}.title`)}
                        <span className="admin-count">×{count}</span>
                      </li>
                    ))}
                    {entry.hidden && (
                      <li className="chip">
                        <Icon name="eye-off" size={16} />
                        {t('admin.hiddenChip')}
                      </li>
                    )}
                  </ul>
                  <p className="note">
                    {t('admin.queue.since', {
                      first: formatDay(entry.firstReportAt, i18n.language, now),
                      last: formatDay(entry.lastReportAt, i18n.language, now),
                    })}
                  </p>
                </div>
                <Link
                  className="btn btn-secondary btn-sm"
                  to={`/admin/reports/${entry.routeId}`}
                >
                  {t('admin.queue.review')}
                </Link>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav className="admin-pager" aria-label={t('admin.queue.pages')}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => goTo(page - 1)}
              >
                <Icon name="back" size={16} />
                {t('admin.queue.previous')}
              </button>
              <span aria-live="polite">
                {t('admin.queue.pageOf', { page, pages })}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={page >= pages}
                onClick={() => goTo(page + 1)}
              >
                {t('admin.queue.next')}
                <Icon name="chevron" size={16} />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
