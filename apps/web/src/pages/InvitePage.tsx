import { useQueryClient } from '@tanstack/react-query';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client.js';
import { useAcceptInvite } from '../api/mutations.js';
import { journeyQuery } from '../api/queries.js';
import { Icon, IconSprite } from '../components/Icon.js';
import { Logo } from '../components/Logo.js';
import { Shared } from '../components/Shared.js';
import { Toaster } from '../components/toast/Toaster.js';
import { useToast } from '../components/toast/useToast.js';
import { setLanguage } from '../i18n/index.js';
import { askForAnother, browserEnv } from '../invite/askAgain.js';
import { InviteEnvelope } from '../invite/InviteEnvelope.js';
import {
  invitePath,
  inviteProblem,
  openingTimeline,
  PROBLEM_VIEW,
  type InviteAction,
  type InviteProblem,
} from '../invite/model.js';
import { loginPathFor } from '../session/nextPath.js';
import { useSession } from '../session/SessionProvider.js';

/**
 * `/invite/:token`: the first screen of someone who was sent a link. The API
 * says nothing about the route or the person before the link is accepted, so
 * the page does not pretend to: a closed envelope, what Filmgrim is, and one
 * thing to do. It loads still: the only movement is the answer to "Accept"
 * (the envelope opens, the title becomes "It's yours", and the strip of the
 * envelope turns into the one of the journey). When the link does not open,
 * the same page says why, in the words of the problem and never as the
 * visitor's fault. It lives outside the app's layout: the guest is not a user
 * yet, so there is no navigation to offer.
 */
export function InvitePage() {
  const { t, i18n } = useTranslation();
  const { token = '' } = useParams();
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accept = useAcceptInvite();
  const still = useReducedMotion() === true;
  const path = invitePath(token);
  // The title of the invitation gives way to "It's yours" a moment after the
  // envelope starts to open (see `openingTimeline`).
  const [titleShown, setTitleShown] = useState(false);

  const problem: InviteProblem | null = accept.isError
    ? inviteProblem(accept.error instanceof ApiError ? accept.error.code : '')
    : null;

  // A different link starts from a clean page (a problem is not carried over).
  const { reset, mutate } = accept;
  useEffect(() => {
    reset();
    setTitleShown(false);
  }, [token, reset]);

  // Accepted: the envelope opens, the title changes and the route follows. The
  // journey is fetched meanwhile so its strip is already there when the page
  // arrives (otherwise the move from one strip to the other has nothing to
  // land on).
  useEffect(() => {
    if (!accept.isSuccess) return;
    const routeId = accept.data.route.id;
    const { titleAt, navigateAt } = openingTimeline(still);
    void queryClient.prefetchQuery(journeyQuery(routeId));
    const title = window.setTimeout(() => setTitleShown(true), titleAt);
    const go = window.setTimeout(
      () => void navigate(`/journeys/${routeId}`, { replace: true }),
      navigateAt,
    );
    return () => {
      window.clearTimeout(title);
      window.clearTimeout(go);
    };
  }, [accept.isSuccess, accept.data, navigate, queryClient, still]);

  // Offline, the page tries again by itself as soon as the network is back.
  useEffect(() => {
    if (problem !== 'offline') return;
    const retry = () => mutate(token);
    window.addEventListener('online', retry, { once: true });
    return () => window.removeEventListener('online', retry);
  }, [problem, mutate, token]);

  const strip = problem
    ? PROBLEM_VIEW[problem].strip
    : accept.isSuccess
      ? 'open'
      : 'closed';
  // From the press until the title changes the button stays, busy.
  const busy = accept.isPending || (accept.isSuccess && !titleShown);
  const accepted = accept.isSuccess ? accept.data.route : null;
  const announce = accepted
    ? t('invite.doneAnnounce', { title: accepted.title })
    : accept.isPending
      ? t('invite.opening')
      : '';

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
        <Shared name="strip" kind="strip">
          <InviteEnvelope state={strip} />
        </Shared>

        {/* Always there, so what is put in it is read out (a live region that
            appears with its text is not reliably announced). */}
        <p className="visually-hidden" aria-live="polite">
          {announce}
        </p>

        {session.status === 'authenticated' && problem ? (
          <ProblemBlock problem={problem} onRetry={() => mutate(token)} />
        ) : accepted && titleShown ? (
          <>
            <p className="invite-eyebrow invite-rise">
              {t('journey.by', { author: accepted.author })}
            </p>
            <h1 className="invite-title invite-rise">{t('invite.done')}</h1>
            <p className="invite-route invite-rise">{accepted.title}</p>
            <div className="invite-action" />
          </>
        ) : (
          <>
            <p className="invite-eyebrow">{t('invite.eyebrow')}</p>
            <h1 className="invite-title">{t('invite.title')}</h1>
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

              {session.status === 'authenticated' && (
                <>
                  {/* aria-disabled, not disabled: the button keeps the focus
                      while it works. */}
                  <button
                    type="button"
                    className="btn invite-primary invite-accept"
                    aria-disabled={busy || undefined}
                    aria-busy={busy || undefined}
                    onClick={() => {
                      if (!busy) mutate(token);
                    }}
                  >
                    {busy ? (
                      <span className="invite-fade">
                        <svg
                          className="arc-spin"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <circle cx="12" cy="12" r="8" pathLength="1" />
                        </svg>
                        {t('invite.opening')}
                      </span>
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
          </>
        )}
      </main>
      <Toaster />
    </div>
  );
}

/**
 * The page when the link does not open: an icon, the phrase of the state, a
 * line that explains and the way out. All of it is one live region, so a
 * screen reader reads it as soon as it appears; the focus goes to the title
 * (not to a button) so that reading starts from the top.
 */
function ProblemBlock({
  problem,
  onRetry,
}: {
  problem: InviteProblem;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const view = PROBLEM_VIEW[problem];

  useEffect(() => {
    titleRef.current?.focus();
  }, [problem]);

  function ask() {
    void askForAnother(t('invite.askAgainText'), browserEnv()).then(
      (result) => {
        if (result === 'copied') toast.textCopied();
        if (result === 'failed') toast.textCopyFailed(ask);
      },
    );
  }

  function button(action: InviteAction, primary: boolean) {
    const className = `btn ${primary ? 'invite-primary' : 'btn-secondary'}`;
    const label = t(`invite.action.${action}`);
    if (action === 'explore' || action === 'editor') {
      return (
        <Link
          key={action}
          className={className}
          to={action === 'explore' ? '/explore' : '/my-routes'}
        >
          {label}
        </Link>
      );
    }
    return (
      <button
        key={action}
        type="button"
        className={className}
        onClick={action === 'retry' ? onRetry : ask}
      >
        {label}
      </button>
    );
  }

  return (
    <div role={view.role} className="invite-state" data-tone={view.tone}>
      <span className="invite-state-icon">
        <Icon name={view.icon} size={24} />
      </span>
      <h1 ref={titleRef} tabIndex={-1}>
        {t(`invite.state.${problem}.title`)}
      </h1>
      <p className="invite-lead">{t(`invite.state.${problem}.body`)}</p>
      <div className="invite-buttons">
        {button(view.primary, true)}
        {view.secondary && button(view.secondary, false)}
      </div>
    </div>
  );
}
