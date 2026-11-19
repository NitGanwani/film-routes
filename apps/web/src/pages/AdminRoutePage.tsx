import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import {
  useDismissReport,
  useDismissRoute,
  useHideRoute,
  useUnhideRoute,
} from '../api/mutations.js';
import { adminRouteQuery } from '../api/queries.js';
import type { AdminReport, AdminReportStatus } from '../api/types.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon, type IconName } from '../components/Icon.js';
import { ErrorBox, RouteListSkeleton } from '../components/States.js';
import { formatDay } from '../editor/invites.js';
import { HideDialog } from '../moderation/HideDialog.js';
import { REASON_ICON } from '../moderation/report.js';
import { ReviewStep } from '../moderation/ReviewStep.js';

/** A report's state is said in words and drawn, never only coloured. */
const STATUS_ICON: Record<AdminReportStatus, IconName> = {
  open: 'pending',
  upheld: 'check',
  dismissed: 'close',
};

/**
 * Judging one reported route: what was said about it, what it says, and what
 * can be done (hide it for a reason the author reads, dismiss the reports, or
 * lift an earlier hiding).
 */
export function AdminRoutePage() {
  const { t, i18n } = useTranslation();
  const { routeId = '' } = useParams();
  const review = useQuery(adminRouteQuery(routeId));
  const hide = useHideRoute(routeId);
  const unhide = useUnhideRoute(routeId);
  const dismissRoute = useDismissRoute(routeId);
  const dismissReport = useDismissReport(routeId);
  const [hiding, setHiding] = useState(false);
  const actions = useRef<HTMLDivElement>(null);

  const back = (
    <Link className="back-link" to="/admin/reports">
      <Icon name="back" size={16} />
      {t('admin.back')}
    </Link>
  );

  if (review.isPending) {
    return (
      <div className="page narrow">
        {back}
        <RouteListSkeleton rows={1} />
      </div>
    );
  }
  if (review.isError) {
    return (
      <div className="page narrow">
        {back}
        <ErrorBox
          message={errorMessage(t, review.error)}
          onRetry={() => void review.refetch()}
        />
      </div>
    );
  }

  const { route, reports } = review.data;
  const open = reports.filter((report) => report.status === 'open');
  const busy =
    hide.isPending ||
    unhide.isPending ||
    dismissRoute.isPending ||
    dismissReport.isPending;
  const failure = [unhide, dismissRoute, dismissReport].find(
    (action) => action.isError,
  )?.error;
  const now = new Date();
  const day = (iso: string) => formatDay(iso, i18n.language, now);

  function closeHide() {
    hide.reset();
    setHiding(false);
  }

  return (
    <div className="page narrow">
      {back}
      <h1>{route.title}</h1>
      <p className="note">
        {t('admin.by', { author: route.author })}
        {' · '}
        {t(`myRoutes.visibility.${route.visibility}`)}
        {' · '}
        {t('admin.review.films', { count: route.steps.length })}
      </p>
      <p>
        <Link
          className="btn btn-ghost btn-sm admin-flush"
          to={`/routes/${route.id}`}
        >
          <Icon name="eye" size={16} />
          {t('admin.review.seePublic')}
        </Link>
      </p>

      <section className="admin-section" aria-labelledby="admin-actions">
        <h2 id="admin-actions">{t('admin.actions.title')}</h2>
        {route.moderation.hidden && (
          <div className="route-notice editor-notice" role="status">
            <Icon name="eye-off" size={18} />
            <div>
              <strong>{t('admin.actions.hidden')}</strong>
              {route.hiddenBy && (
                <p>{t('admin.actions.hiddenBy', { admin: route.hiddenBy })}</p>
              )}
              {route.moderation.reason && (
                <p>
                  {t('editor.hidden.reason', {
                    reason: route.moderation.reason,
                  })}
                </p>
              )}
            </div>
          </div>
        )}
        <div className="admin-actions" ref={actions}>
          {route.moderation.hidden ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => unhide.mutate()}
            >
              {t('admin.actions.unhide')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() => setHiding(true)}
            >
              <Icon name="eye-off" size={16} />
              {t('admin.actions.hide')}
            </button>
          )}
          {open.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => dismissRoute.mutate()}
            >
              {t('admin.actions.dismissAll', { count: open.length })}
            </button>
          )}
        </div>
        {failure && (
          <p className="form-error" role="alert">
            {errorMessage(t, failure)}
          </p>
        )}
      </section>

      <section className="admin-section" aria-labelledby="admin-reports">
        <h2 id="admin-reports">
          {t('admin.reports.title', { count: reports.length })}
        </h2>
        <p className="note">
          {t('admin.reports.open', { count: open.length })}
        </p>
        <ul className="admin-reports">
          {reports.map((report) => (
            <ReportItem
              key={report.id}
              report={report}
              day={day}
              busy={busy}
              pending={
                dismissReport.isPending && dismissReport.variables === report.id
              }
              onDismiss={() => dismissReport.mutate(report.id)}
            />
          ))}
        </ul>
      </section>

      <section className="admin-section" aria-labelledby="admin-content">
        <h2 id="admin-content">{t('admin.review.content')}</h2>
        {route.description && (
          <p className="review-description">{route.description}</p>
        )}
        <ol className="review-steps">
          {route.steps.map((step) => (
            <ReviewStep key={step.id} step={step} />
          ))}
        </ol>
      </section>

      {/* AnimatePresence keeps the sheet on screen while it slides away. */}
      <AnimatePresence
        onExitComplete={() => actions.current?.querySelector('button')?.focus()}
      >
        {hiding && (
          <HideDialog
            key="hide"
            pending={hide.isPending}
            error={hide.isError ? errorMessage(t, hide.error) : null}
            onSubmit={(body) =>
              hide.mutate(body, { onSuccess: () => closeHide() })
            }
            onCancel={closeHide}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ReportItem({
  report,
  day,
  busy,
  pending,
  onDismiss,
}: {
  report: AdminReport;
  day: (iso: string) => string;
  busy: boolean;
  pending: boolean;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li className="card admin-report" data-status={report.status}>
      <div className="admin-report-head">
        <span className="chip">
          <Icon name={REASON_ICON[report.reason]} size={16} />
          {t(`report.reasons.${report.reason}.title`)}
        </span>
        <span className="chip">
          <Icon name={STATUS_ICON[report.status]} size={16} />
          {t(`admin.reports.status.${report.status}`)}
        </span>
      </div>
      <p className="note">
        {t('admin.reports.from', {
          reporter: report.reporter,
          date: day(report.createdAt),
        })}
        {report.resolvedAt &&
          ` · ${t('admin.reports.closedOn', { date: day(report.resolvedAt) })}`}
      </p>
      {report.note ? (
        <blockquote className="admin-note">{report.note}</blockquote>
      ) : (
        <p className="note">{t('admin.reports.noNote')}</p>
      )}
      {report.status === 'open' && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={onDismiss}
        >
          {pending ? t('admin.reports.dismissing') : t('admin.reports.dismiss')}
        </button>
      )}
    </li>
  );
}
