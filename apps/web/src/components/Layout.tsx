import type Lenis from 'lenis';
import { useEffect, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { setLanguage } from '../i18n/index.js';
import { useSmoothScroll } from '../motion/useSmoothScroll.js';
import { useSession } from '../session/SessionProvider.js';
import { Avatar } from './Avatar.js';
import { IconSprite } from './Icon.js';
import { VerifyBanner } from './VerifyBanner.js';

/** The shell: top navigation, the page, and the TMDB notice. */
export function Layout() {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const signedIn = session.status === 'authenticated';
  const lenis = useSmoothScroll();

  return (
    <div className="site">
      <IconSprite />
      <ScrollToTop lenis={lenis} />
      <header className="topnav">
        <Link className="brand" to="/">
          {t('app.name')}
        </Link>
        <nav aria-label={t('nav.main')}>
          <NavLink to="/explore">{t('nav.explore')}</NavLink>
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

      {session.status === 'authenticated' && !session.user.emailVerified && (
        <VerifyBanner />
      )}

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

/** A new page starts at the top, as with a normal link (the router keeps the old scroll). */
function ScrollToTop({ lenis }: { lenis: RefObject<Lenis | null> }) {
  const { pathname } = useLocation();
  useEffect(() => {
    // Lenis keeps its own target position: tell it, or it would glide back.
    if (lenis.current) lenis.current.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  }, [pathname, lenis]);
  return null;
}
