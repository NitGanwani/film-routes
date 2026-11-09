import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router';
import { loginPathFor } from '../session/nextPath.js';
import { useSession } from '../session/SessionProvider.js';

/**
 * Pages that need an account. Someone who is not signed in goes to the login
 * and comes back to this page afterwards.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const session = useSession();
  const location = useLocation();

  if (session.status === 'loading') return <p>{t('common.loading')}</p>;
  if (session.status === 'anonymous') {
    return (
      <Navigate
        to={loginPathFor(`${location.pathname}${location.search}`)}
        replace
      />
    );
  }
  return children;
}
