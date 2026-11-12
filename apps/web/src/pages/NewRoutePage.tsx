import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '../components/Icon.js';

/** Where a route is written. For now only the page: the form comes next. */
export function NewRoutePage() {
  const { t } = useTranslation();
  return (
    <div className="page narrow">
      <Link className="back-link" to="/my-routes">
        <Icon name="back" size={18} />
        {t('myRoutes.title')}
      </Link>
      <h1>{t('myRoutes.newTitle')}</h1>
      <p className="note">{t('myRoutes.soon')}</p>
    </div>
  );
}
