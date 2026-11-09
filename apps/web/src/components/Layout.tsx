import { useTranslation } from 'react-i18next';
import { Link, Outlet } from 'react-router';
import { setLanguage } from '../i18n/index.js';
import { useSession } from '../session/SessionProvider.js';

/** Navigation shell. Deliberately unstyled until the design is ready. */
export function Layout() {
  const { t, i18n } = useTranslation();
  const session = useSession();

  return (
    <>
      <header>
        <Link to="/">{t('app.name')}</Link>{' '}
        <nav>
          <Link to="/">{t('nav.explore')}</Link>{' '}
          {session.status === 'authenticated' ? (
            <>
              <Link to="/journeys">{t('nav.journeys')}</Link>{' '}
              <span>{session.user.username}</span>{' '}
              <button type="button" onClick={() => void session.logout()}>
                {t('nav.logout')}
              </button>
            </>
          ) : (
            session.status === 'anonymous' && (
              <>
                <Link to="/login">{t('nav.login')}</Link>{' '}
                <Link to="/register">{t('nav.register')}</Link>
              </>
            )
          )}{' '}
          <label>
            {t('nav.language')}{' '}
            <select
              value={i18n.language}
              onChange={(event) =>
                setLanguage(event.target.value === 'en' ? 'en' : 'es')
              }
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      {/* TMDB's terms require this notice wherever its data is shown. */}
      <footer>
        <small>{t('footer.tmdb')}</small>
      </footer>
    </>
  );
}
