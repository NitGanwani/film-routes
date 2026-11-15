import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { AuthorRouteDetail } from '../api/types.js';
import { EmptyState } from '../components/States.js';
import { tabPath } from './tabs.js';

/**
 * The tab of the people on the route. The list and the comparison come in the
 * next phase; until then it only says what will be here, and, for a private
 * route with nobody in it, where to start.
 */
export function TravelersPanel({ route }: { route: AuthorRouteDetail }) {
  const { t } = useTranslation();
  const isPrivate = route.visibility === 'private';

  if (isPrivate && !route.locked) {
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
  return (
    <EmptyState
      title={t('travelers.soonTitle')}
      text={t('travelers.soonText')}
    />
  );
}
