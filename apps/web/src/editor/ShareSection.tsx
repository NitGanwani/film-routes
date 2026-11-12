import { ROUTE_LIMITS, type RouteVisibility } from '@film-routes/shared';
import { AnimatePresence } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useChangeVisibility } from '../api/mutations.js';
import type { AuthorRouteDetail } from '../api/types.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon } from '../components/Icon.js';
import { useResendVerification } from '../components/useResendVerification.js';
import { VISIBILITY_ICON } from '../myRoutes/model.js';
import { useSession } from '../session/SessionProvider.js';
import {
  canChoose,
  needsShareWarning,
  shareLink,
  shareRequirements,
} from './share.js';

/** How long "Copied" stays on the button. */
const COPIED_MS = 2000;

/**
 * "Share": who can see the route, what it still needs before it can be shared,
 * and the warning that comes with sharing. The last decision of the guide, so
 * it sits at the end of the editor and lists the requirements first.
 */
export function ShareSection({ route }: { route: AuthorRouteDetail }) {
  const { t } = useTranslation();
  const headingId = useId();
  const groupId = useId();
  const { user } = useSession();
  const change = useChangeVisibility(route.id);
  const resend = useResendVerification();
  const requirements = shareRequirements({
    stepCount: route.steps.length,
    emailVerified: user?.emailVerified ?? false,
  });
  const { hidden, reason } = route.moderation;

  // The option waiting for a yes in the warning, and where the focus returns.
  const [asking, setAsking] = useState<RouteVisibility | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  function choose(option: RouteVisibility) {
    if (option === route.visibility || change.isPending) return;
    if (!canChoose(option, requirements)) return;
    change.reset();
    if (
      needsShareWarning({
        current: route.visibility,
        next: option,
        locked: route.locked,
      })
    ) {
      trigger.current = document.activeElement as HTMLElement | null;
      setAsking(option);
      return;
    }
    change.mutate(option);
  }

  if (hidden) {
    return (
      <section className="editor-share" aria-labelledby={headingId}>
        <h2 id={headingId}>{t('share.title')}</h2>
        <div className="route-notice editor-notice" role="note">
          <Icon name="alert" size={18} />
          <div>
            <strong>{t('editor.hidden.title')}</strong>
            {reason && <p>{t('editor.hidden.reason', { reason })}</p>}
            <p>{t('share.hidden')}</p>
          </div>
        </div>
      </section>
    );
  }

  const options = [
    ['private', 'share.private'],
    ['unlisted', 'share.link'],
    ['public', 'share.public'],
  ] as const;

  return (
    <section className="editor-share" aria-labelledby={headingId}>
      <h2 id={headingId}>{t('share.title')}</h2>

      <div className="share-requirements">
        <h3>{t('share.requirements.title')}</h3>
        <ul>
          <li data-met={requirements.filmsOk}>
            <Icon name={requirements.filmsOk ? 'check' : 'pending'} size={16} />
            <span>
              {t('share.requirements.films', {
                count: requirements.count,
                min: ROUTE_LIMITS.minSteps,
                max: ROUTE_LIMITS.maxSteps,
              })}
            </span>
          </li>
          <li data-met={requirements.emailOk}>
            <Icon name={requirements.emailOk ? 'check' : 'pending'} size={16} />
            <span>{t('share.requirements.email')}</span>
            {!requirements.emailOk && resend.status !== 'sent' && (
              <button
                type="button"
                className="link-button"
                disabled={resend.status === 'sending'}
                onClick={() => void resend.resend()}
              >
                {t('share.requirements.resend')}
              </button>
            )}
            {resend.status === 'sent' && (
              <span role="status" className="share-sent">
                {t('banner.sent')}
              </span>
            )}
          </li>
        </ul>
        {resend.error && (
          <p className="form-error" role="alert">
            {resend.error}
          </p>
        )}
      </div>

      <div
        className="share-options"
        role="radiogroup"
        aria-labelledby={headingId}
        aria-describedby={
          requirements.missing.length > 0 ? `${groupId}-missing` : undefined
        }
      >
        {options.map(([option, key]) => {
          const available = canChoose(option, requirements);
          return (
            <label
              key={option}
              className="share-option"
              data-checked={route.visibility === option}
              data-unavailable={!available}
            >
              <input
                className="visually-hidden"
                type="radio"
                name={`${groupId}-visibility`}
                checked={route.visibility === option}
                aria-disabled={!available}
                onChange={() => choose(option)}
              />
              <Icon name={VISIBILITY_ICON[option]} size={22} />
              <span className="share-option-name">{t(key)}</span>
              <span className="share-option-hint">{t(`${key}Hint`)}</span>
            </label>
          );
        })}
      </div>

      {requirements.missing.length > 0 && (
        <p id={`${groupId}-missing`} className="hint share-missing">
          {t('share.missing', {
            list: requirements.missing
              .map((item) =>
                t(`share.missingItem.${item}`, {
                  min: ROUTE_LIMITS.minSteps,
                  max: ROUTE_LIMITS.maxSteps,
                }),
              )
              .join(', '),
          })}
        </p>
      )}

      {change.isError && (
        <p className="form-error" role="alert">
          {errorMessage(t, change.error)}
        </p>
      )}

      {route.locked && (
        <div className="route-notice editor-notice" role="note">
          <Icon name="lock" size={18} />
          <p>{t('share.lockedBody')}</p>
        </div>
      )}

      {route.visibility !== 'private' && <ShareLink routeId={route.id} />}

      <AnimatePresence onExitComplete={() => trigger.current?.focus()}>
        {asking && (
          <ConfirmDialog
            title={t('share.confirm.title')}
            body={t('share.confirm.body')}
            confirmLabel={t('share.confirm.ok')}
            cancelLabel={t('share.confirm.cancel')}
            onConfirm={() => {
              change.mutate(asking);
              setAsking(null);
            }}
            onCancel={() => setAsking(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

/** The public link of a shared route, with a button that copies it. */
function ShareLink({ routeId }: { routeId: string }) {
  const { t } = useTranslation();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const link = shareLink(window.location.origin, routeId);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // No clipboard (or it was refused): leave the link selected to copy by hand.
      inputRef.current?.select();
    }
  }

  return (
    <div className="share-link">
      <label htmlFor={`${id}-link`}>{t('share.linkLabel')}</label>
      <div className="share-link-row">
        <input
          id={`${id}-link`}
          ref={inputRef}
          className="input"
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void copy()}
        >
          {copied && <Icon name="check" size={16} />}
          <span aria-live="polite">
            {copied ? t('share.copied') : t('share.copy')}
          </span>
        </button>
      </div>
      <Link className="share-invite-link" to={{ hash: '#invites' }}>
        {t('share.inviteLimit')}
      </Link>
    </div>
  );
}
