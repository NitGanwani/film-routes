import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/States.js';

/** How long a resumed session can take before the person is told why. */
export const SLOW_SESSION_MS = 3_000;

/**
 * What a page shows while it waits to know who is signed in. At first
 * `placeholder` (nothing, or a plain "Loading"); if the server is slow or out
 * of reach, a notice that says so: the session is kept and the page recovers
 * by itself (see SessionProvider), but a blank screen would look broken, above
 * all in the installed app opened without a network.
 */
export function SessionWaiting({
  placeholder = null,
}: {
  placeholder?: ReactNode;
}) {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_SESSION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!slow) return placeholder;
  return (
    <div className="page narrow" role="status">
      <EmptyState
        icon="signal"
        title={t('connection.title')}
        text={t('connection.body')}
      />
    </div>
  );
}
