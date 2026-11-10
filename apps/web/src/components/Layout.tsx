import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router';
import { setLanguage } from '../i18n/index.js';
import { useSession } from '../session/SessionProvider.js';
import { Avatar } from './Avatar.js';
import { IconSprite } from './Icon.js';
import { ThemeToggle } from './ThemeToggle.js';

/** The shell: top navigation, the page, and the TMDB notice. */
export function Layout() {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const signedIn = session.status === 'authenticated';

  return (
    <div className="site">
      <IconSprite />
      <header className="topnav">
        <Link className="brand" to="/">
          {t('app.name')}
        </Link>
        <nav aria-label={t('nav.main')}>
          <NavLink to="/" end>
            {t('nav.explore')}
          </NavLink>
          {signedIn && <NavLink to="/journeys">{t('nav.journeys')}</NavLink>}
        </nav>
        <div className="me">
          <select
            aria-label={t('nav.language')}
            value={i18n.language}
            onChange={(event) =>
              setLanguage(event.target.value === 'en' ? 'en' : 'es')
            }
          >
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
          <ThemeToggle />
          {session.status === 'authenticated' && (
            <>
              <Avatar name={session.user.username} />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void session.logout()}
              >
                {t('nav.logout')}
              </button>
            </>
          )}
          {session.status === 'anonymous' && (
            <>
              <Link className="btn btn-ghost btn-sm" to="/login">
                {t('nav.login')}
              </Link>
              <Link className="btn btn-primary btn-sm" to="/register">
                {t('nav.register')}
              </Link>
            </>
          )}
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      {/* TMDB's terms require this notice wherever its data is shown. The
          official logo goes next to it (see docs). */}
      <footer className="site-footer">
        <div className="inner">
          <span className="tmdb-mark" aria-label="TMDB">
            TMDB
          </span>
          <span>{t('footer.tmdb')}</span>
          <Link to="/welcome">{t('nav.howItWorks')}</Link>
        </div>
      </footer>
    </div>
  );
}
