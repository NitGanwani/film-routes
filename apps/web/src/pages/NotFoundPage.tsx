import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section>
      <p>{t('common.notFound')}</p>
      <Link to="/">{t('nav.explore')}</Link>
    </section>
  );
}
