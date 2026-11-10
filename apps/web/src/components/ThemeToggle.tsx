import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  applyTheme,
  otherTheme,
  saveTheme,
  savedTheme,
  systemTheme,
} from '../theme/theme.js';
import { Icon } from './Icon.js';

/**
 * Light / dark switch. Until the person picks one, the system setting rules
 * (and the icon follows it); after that, their choice is remembered.
 */
export function ThemeToggle() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(() => savedTheme() ?? systemTheme());

  // While nothing is chosen, follow the system if it changes (e.g. at sunset).
  useEffect(() => {
    if (savedTheme()) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = () => {
      if (!savedTheme()) setTheme(systemTheme());
    };
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, []);

  const next = otherTheme(theme);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={t(next === 'dark' ? 'nav.themeToDark' : 'nav.themeToLight')}
      title={t(next === 'dark' ? 'nav.themeToDark' : 'nav.themeToLight')}
      onClick={() => {
        applyTheme(next);
        saveTheme(next);
        setTheme(next);
      }}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
