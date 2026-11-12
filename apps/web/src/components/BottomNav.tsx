import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { Icon } from './Icon.js';
import { NAV_LINKS } from './navLinks.js';

/**
 * The main links as a bar fixed to the bottom of the screen, within reach of a
 * thumb. Phones only, and only with a session: the top bar takes over from 900 px
 * (the CSS shows one or the other, so there is never a second "Main" landmark).
 */
export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav className="bottom-nav" aria-label={t('nav.main')}>
      {NAV_LINKS.map(({ to, label, icon }) => (
        <NavLink key={to} to={to}>
          <Icon name={icon} size={22} />
          <span>{t(label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
