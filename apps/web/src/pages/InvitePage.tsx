import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client.js';
import { useAcceptInvite } from '../api/mutations.js';
import { Icon, IconSprite } from '../components/Icon.js';
import { Logo } from '../components/Logo.js';
import { setLanguage } from '../i18n/index.js';
import { InviteEnvelope } from '../invite/InviteEnvelope.js';
import {
  invitePath,
  inviteProblem,
  OPEN_MS,
  OPEN_MS_STILL,
  wayOut,
} from '../invite/model.js';
import { loginPathFor } from '../session/nextPath.js';
import { useSession } from '../session/SessionProvider.js';

/**
 * `/invite/:token`: the first screen of someone who was sent a link. The API
 * says nothing about the route or the person before the link is accepted, so
 * the page does not pretend to: a closed envelope, what Filmgrim is, and one
 * thing to do. Only the block with the action changes with the state; the
 * rest of the page stays put. It lives outside the app's layout: the guest is
 * not a user yet, so there is no navigation to offer.
 */
export function InvitePage() {
  const { t, i18n } = useTranslation();
  const { token = '' } = useParams();
  const session = useSession();
  const navigate = useNavigate();
  const accept = useAcceptInvite();
  const still = useReducedMotion() === true;
  const problemRef = useRef<HTMLDivElement>(null);
  const path = invitePath(token);

  // A different link starts from a clean page (a problem is not carried over).
  const { reset } = accept;
  useEffect(() => reset(), [token, reset]);

  // Once it is accepted, the envelope opens and, a moment later, the route.
  useEffect(() => {
    if (!accept.isSuccess) return;
    const routeId = accept.data.route.id;
    const timer = window.setTimeout(
      () => void navigate(`/journeys/${routeId}`, { replace: true }),
      still ? OPEN_MS_STILL : OPEN_MS,
    );
    return () => window.clearTimeout(timer);
  }, [accept.isSuccess, accept.data, navigate, still]);

  // The button that was pressed is gone when the problem appears: the focus
  // goes to the way out instead of falling to the page.
  useEffect(() => {
    if (accept.isError) {
      problemRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    }
  }, [accept.isError]);

  return (
    <div className="invite-page">
      <IconSprite />
      <header className="invite-bar">
        <span />
        <div role="img" aria-label={t('app.name')}>
          <Logo className="logo" />
        </div>
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
      </header>

      <main className="invite-main">
        <InviteEnvelope open={accept.isSuccess} />
        <p className="invite-eyebrow">{t('invite.eyebrow')}</p>
        <h1>{t('invite.title')}</h1>
        <p className="invite-lead">{t('invite.lead')}</p>

        <div className="invite-action">
          {session.status === 'anonymous' && (
            <>
              <div className="invite-buttons">
                <Link
                  className="btn invite-primary"
                  to={`/register?next=${encodeURIComponent(path)}`}
                >
                  {t('invite.register')}
                </Link>
                <Link className="btn btn-secondary" to={loginPathFor(path)}>
                  {t('invite.login')}
                </Link>
              </div>
              <p className="invite-foot">{t('invite.foot')}</p>
            </>
          )}

          {session.status === 'authenticated' && accept.isSuccess && (
            <p className="invite-done" role="status">
              <Icon name="check" size={18} />
              {t('invite.done')}
            </p>
          )}

          {session.status === 'authenticated' && accept.isError && (
            <Problem
              error={accept.error}
              path={path}
              problemRef={problemRef}
              onRetry={() => accept.mutate(token)}
            />
          )}

          {session.status === 'authenticated' &&
            !accept.isSuccess &&
            !accept.isError && (
              <>
                <button
                  type="button"
                  className="btn invite-primary invite-accept"
                  disabled={accept.isPending}
                  aria-busy={accept.isPending}
                  onClick={() => accept.mutate(token)}
                >
                  {accept.isPending ? (
                    <>
                      <svg
                        className="invite-spin"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <circle cx="12" cy="12" r="8" />
                      </svg>
                      {t('invite.opening')}
                    </>
                  ) : (
                    t('invite.accept')
                  )}
                </button>
                <p className="invite-as">
                  {t('invite.joinAs', { name: session.user.username })}
                </p>
              </>
            )}
        </div>
      </main>
    </div>
  );
}

/** Why it did not open, in words, with the one thing that can be done. */
function Problem({
  error,
  path,
  problemRef,
  onRetry,
}: {
  error: unknown;
  path: string;
  problemRef: RefObject<HTMLDivElement | null>;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const problem = inviteProblem(
    error instanceof ApiError ? error.code : 'unknown',
  );
  const out = wayOut(problem);

  return (
    <div ref={problemRef} className="invite-problem">
      <p role="alert">
        <Icon name="alert" size={20} />
        <span>{t(`invite.problem.${problem}`)}</span>
      </p>
      {out === 'retry' ? (
        <button type="button" className="btn invite-primary" onClick={onRetry}>
          {t('common.retry')}
        </button>
      ) : (
        <Link
          className="btn btn-secondary"
          to={
            out === 'login'
              ? loginPathFor(path)
              : out === 'myRoutes'
                ? '/my-routes'
                : '/explore'
          }
        >
          {t(`invite.wayOut.${out}`)}
        </Link>
      )}
    </div>
  );
}
