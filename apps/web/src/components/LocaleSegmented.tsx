import { LOCALES, type Locale } from '@film-routes/shared';

/** Spanish or English, as two native radios drawn as a segmented control. */
export function LocaleSegmented({
  name,
  value,
  onChange,
}: {
  name: string;
  value: Locale;
  onChange: (locale: Locale) => void;
}) {
  return (
    <div className="seg">
      {LOCALES.map((locale) => (
        <label key={locale}>
          <input
            className="visually-hidden"
            type="radio"
            name={name}
            value={locale}
            checked={value === locale}
            onChange={() => onChange(locale)}
          />
          {locale.toUpperCase()}
        </label>
      ))}
    </div>
  );
}
