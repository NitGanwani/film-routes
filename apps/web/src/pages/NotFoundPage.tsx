import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { EmptyState } from '../components/States.js';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="page narrow">
      <EmptyState title={t('common.notFound')}>
        <Link className="btn btn-secondary btn-sm" to="/">
          {t('nav.explore')}
        </Link>
      </EmptyState>
    </div>
  );
}
