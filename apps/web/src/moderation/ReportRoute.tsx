import { AnimatePresence } from 'motion/react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { useReportRoute } from '../api/mutations.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon } from '../components/Icon.js';
import { useToast } from '../components/toast/useToast.js';
import { loginPathFor } from '../session/nextPath.js';
import { useSession } from '../session/SessionProvider.js';
import { ReportDialog } from './ReportDialog.js';

/**
 * "Report this route": a quiet button at the foot of a route page. Someone
 * without an account is taken to sign in and brought back; the author of the
 * route does not see it (the API would refuse it anyway).
 */
export function ReportRoute({
  routeId,
  author,
}: {
  routeId: string;
  /** The username of the route's author. */
  author: string;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const location = useLocation();
  const toast = useToast();
  const report = useReportRoute(routeId);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  // The notice waits for the sheet to leave: while a modal is open the Toaster
  // draws its notices inside it, and they would go away with it.
  const sent = useRef(false);

  if (session.status === 'loading') return null;
  if (session.status === 'authenticated' && session.user.username === author) {
    return null;
  }

  if (session.status === 'anonymous') {
    return (
      <Link
        className="btn btn-ghost btn-sm report-open"
        to={loginPathFor(location.pathname)}
      >
        <Icon name="flag" size={16} />
        {t('report.open')}
      </Link>
    );
  }

  function close() {
    report.reset();
    setOpen(false);
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        className="btn btn-ghost btn-sm report-open"
        onClick={() => setOpen(true)}
      >
        <Icon name="flag" size={16} />
        {t('report.open')}
      </button>
      {/* AnimatePresence keeps the sheet on screen while it slides away. */}
      <AnimatePresence
        onExitComplete={() => {
          button.current?.focus();
          if (sent.current) {
            sent.current = false;
            toast.reported();
          }
        }}
      >
        {open && (
          <ReportDialog
            key="report"
            pending={report.isPending}
            error={report.isError ? errorMessage(t, report.error) : null}
            onSubmit={(body) =>
              report.mutate(body, {
                onSuccess: () => {
                  sent.current = true;
                  close();
                },
              })
            }
            onCancel={close}
          />
        )}
      </AnimatePresence>
    </>
  );
}
