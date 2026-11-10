import type { Locale } from '@film-routes/shared';
import { useTranslation } from 'react-i18next';

/** Which language a route is written in, so nobody opens one they cannot read by surprise. */
export function LanguageTag({ locale }: { locale: Locale }) {
  const { t } = useTranslation();
  const name = t(`languages.${locale}`);
  return (
    <span
      className="badge"
      title={t('route.writtenIn', { language: name })}
      aria-label={t('route.writtenIn', { language: name })}
    >
      {locale.toUpperCase()}
    </span>
  );
}
