import { AnimatePresence } from 'motion/react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useRemoveTraveler } from '../api/mutations.js';
import { useTravelers } from '../api/queries.js';
import type { AuthorRouteDetail, Traveler } from '../api/types.js';
import { Avatar } from '../components/Avatar.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon } from '../components/Icon.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { EmptyState, ErrorBox } from '../components/States.js';
import { formatDay } from './invites.js';
import { TravelerChip } from './TravelerChip.js';
import { TravelerDetail } from './TravelerDetail.js';
import { tabPath, travelerPath } from './tabs.js';
import {
  sortTravelers,
  travelersSummary,
  visibleTravelers,
} from './travelers.js';

/**
 * The people on the route: who joined, how far each one is, and the way to
 * take someone off. A row opens that traveler's page, where their emotions are
 * set next to the author's.
 */
export function TravelersPanel({
  route,
  enrollmentId,
}: {
  route: AuthorRouteDetail;
  /** The traveler whose page is open, or null for the list. */
  enrollmentId: string | null;
}) {
  const { t } = useTranslation();
  const isPrivate = route.visibility === 'private';

  // A private route with nobody in it has nothing to show yet.
  if (isPrivate && !route.locked && !route.moderation.hidden) {
    return (
      <EmptyState title={t('invites.privateFirst')}>
        <Link
          className="btn btn-primary"
          to={{ pathname: tabPath(route.id, 'route'), hash: '#share' }}
        >
          {t('share.title')}
        </Link>
      </EmptyState>
    );
  }
  return enrollmentId ? (
    <TravelerDetail route={route} enrollmentId={enrollmentId} />
  ) : (
    <TravelerList route={route} />
  );
}

function TravelerList({ route }: { route: AuthorRouteDetail }) {
  const { t, i18n } = useTranslation();
  const travelers = useTravelers(route.id);
  const remove = useRemoveTraveler(route.id);
  const [removing, setRemoving] = useState<Traveler | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  // Where the focus goes when the dialog closes: back to its button, unless
  // the person is gone, and then to the title of the list.
  const removedOne = useRef(false);

  const { hidden, reason } = route.moderation;
  const list = travelers.data
    ? sortTravelers(visibleTravelers(travelers.data))
    : null;
  const summary = list ? travelersSummary(list) : null;
  const canInvite = route.visibility !== 'private' && !hidden;

  return (
    <div className="travelers">
      {hidden && (
        <div className="route-notice editor-notice" role="note">
          <Icon name="alert" size={18} />
          <div>
            <strong>{t('editor.hidden.title')}</strong>
            {reason && <p>{t('editor.hidden.reason', { reason })}</p>}
            <p>{t('share.hidden')}</p>
          </div>
        </div>
      )}

      <header className="travelers-head">
        <h2 ref={heading} tabIndex={-1}>
          {t('travelers.title')}
        </h2>
        {summary && summary.total > 0 && (
          <p className="travelers-count">
            {t('travelers.count', { count: summary.total })}
            {summary.completed > 0 &&
              ` · ${t('travelers.completedCount', { count: summary.completed })}`}
          </p>
        )}
      </header>

      {travelers.isPending && (
        <div className="invite-skeleton" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="skel" style={{ height: '88px' }} />
          ))}
          <p className="visually-hidden" role="status">
            {t('common.loading')}
          </p>
        </div>
      )}
      {travelers.isError && (
        <ErrorBox
          message={errorMessage(t, travelers.error)}
          onRetry={() => void travelers.refetch()}
        />
      )}
      {list?.length === 0 && (
        <EmptyState
          strip
          title={t('travelers.empty.title')}
          text={t('travelers.empty.body')}
        >
          {canInvite && (
            <Link className="btn btn-primary" to={tabPath(route.id, 'invites')}>
              {t('tabs.invites')}
            </Link>
          )}
        </EmptyState>
      )}
      {list && list.length > 0 && (
        <ul className="traveler-list">
          {list.map((traveler) => (
            <li key={traveler.id} className="traveler-row">
              <Avatar name={traveler.username} />
              <div className="traveler-main">
                <Link
                  className="traveler-link"
                  to={travelerPath(route.id, traveler.id)}
                >
                  {traveler.username}
                </Link>
                <TravelerChip status={traveler.status} />
              </div>
              <div className="traveler-progress">
                <ProgressBar
                  closed={traveler.closedSteps}
                  total={traveler.stepCount}
                  label={t('travelers.closedOf', {
                    closed: traveler.closedSteps,
                    total: traveler.stepCount,
                  })}
                />
              </div>
              <span className="traveler-since">
                {t('travelers.since', {
                  date: formatDay(
                    traveler.startedAt,
                    i18n.language,
                    new Date(),
                  ),
                })}
              </span>
              <button
                type="button"
                className="btn btn-secondary traveler-remove"
                onClick={(event) => {
                  trigger.current = event.currentTarget;
                  removedOne.current = false;
                  remove.reset();
                  setRemoving(traveler);
                }}
              >
                {t('travelers.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence
        onExitComplete={() =>
          (removedOne.current ? heading.current : trigger.current)?.focus()
        }
      >
        {removing && (
          <ConfirmDialog
            danger
            title={t('travelers.removeConfirm.title', {
              name: removing.username,
            })}
            body={t('travelers.removeConfirm.body')}
            confirmLabel={t('travelers.removeConfirm.ok')}
            cancelLabel={t('travelers.removeConfirm.cancel')}
            pending={remove.isPending}
            error={remove.isError ? errorMessage(t, remove.error) : null}
            onConfirm={() =>
              remove.mutate(removing.id, {
                onSuccess: () => {
                  removedOne.current = true;
                  setRemoving(null);
                },
              })
            }
            onCancel={() => setRemoving(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
