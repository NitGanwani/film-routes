import type { ReactNode } from 'react';
import { NotFoundPage } from '../pages/NotFoundPage.js';
import { useSession } from '../session/SessionProvider.js';
import { RequireSession } from './RequireSession.js';

/**
 * Pages for moderators. Anyone else gets the ordinary "not found", the same as
 * the API's unknown paths: nothing says that these pages exist. The API checks
 * the role again on every request; this only keeps the screens out of sight.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <AdminOnly>{children}</AdminOnly>
    </RequireSession>
  );
}

function AdminOnly({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status !== 'authenticated' || !session.user.isAdmin) {
    return <NotFoundPage />;
  }
  return children;
}
