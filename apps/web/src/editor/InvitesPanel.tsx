import { ROUTE_LIMITS } from '@film-routes/shared';
import { AnimatePresence } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useRevokeInvite } from '../api/mutations.js';
import { useInvites } from '../api/queries.js';
import type {
  AuthorRouteDetail,
  CreatedInvite,
  Invite,
  InviteStatus,
} from '../api/types.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon, type IconName } from '../components/Icon.js';
import { EmptyState, ErrorBox } from '../components/States.js';
import { useToast } from '../components/toast/useToast.js';
import { useMediaQuery } from '../components/useMediaQuery.js';
import { useSession } from '../session/SessionProvider.js';
import { InviteCreator } from './InviteCreator.js';
import { InviteSheet } from './InviteSheet.js';
import { formatDay, inviteLink, sortInvites } from './invites.js';
import { shareRequirements } from './share.js';
import { tabPath } from './tabs.js';

/** One icon per state, so the chip never depends on its colour. */
const STATUS_ICON = {
  active: 'link',
  exhausted: 'check',
  expired: 'pending',
  revoked: 'eye-off',
} as const satisfies Record<InviteStatus, IconName>;

/**
 * The invitations of a route: make a link (how many people, how long), see the
 * ones that exist and revoke those that still work. A link can only be copied
 * when it is made; the server keeps no way to show it again.
 */
export function InvitesPanel({ route }: { route: AuthorRouteDetail }) {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const toast = useToast();
  const invites = useInvites(route.id);
  const wide = useMediaQuery('(min-width: 720px)');
  const [creating, setCreating] = useState(false);
  // The link just made, so the list can bring its row in softly.
  const [freshId, setFreshId] = useState<string | null>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  // On a wide screen the panel is at the side of the page and the link is a
  // long way from the pointer: a notice says it is made and offers to copy it.
  // On a phone the sheet already shows the link in big, so it adds nothing.
  function announce(invite: CreatedInvite) {
    const link = inviteLink(window.location.origin, invite.token);
    const copy = () =>
      void navigator.clipboard.writeText(link).then(toast.copied, () => {
        toast.copyFailed(copy);
      });
    const uses =
      invite.maxUses === null
        ? t('toast.inviteNoLimit')
        : t('invites.usesCount', { count: invite.maxUses });
    const expiry = invite.expiresAt
      ? t('toast.inviteExpires', {
          date: formatDay(invite.expiresAt, i18n.language, new Date()),
        })
      : t('toast.inviteNoExpiry');
    toast.inviteCreated(`${uses} · ${expiry}`, copy);
  }
  const panelRef = useRef<HTMLElement>(null);
  const panelId = useId();
  // The form opens in the page, away from the button that asked for it: the
  // focus goes in, and the next Tab is its first field.
  const inline = creating && wide;
  useEffect(() => {
    if (inline) panelRef.current?.focus();
  }, [inline]);

  const { hidden, reason } = route.moderation;
  const requirements = shareRequirements({
    stepCount: route.steps.length,
    emailVerified: user?.emailVerified ?? false,
  });
  const isPrivate = route.visibility === 'private';
  const shareTo = { pathname: tabPath(route.id, 'route'), hash: '#share' };
  // A private route with nobody inside has nothing to invite people to yet.
  if (isPrivate && !route.locked && !hidden) {
    return (
      <EmptyState title={t('invites.privateFirst')}>
        <Link className="btn btn-primary" to={shareTo}>
          {t('share.title')}
        </Link>
      </EmptyState>
    );
  }

  const blocker = hidden
    ? null
    : requirements.missing.length > 0
      ? t('invites.missing', {
          list: requirements.missing
            .map((item) =>
              t(`share.missingItem.${item}`, {
                min: ROUTE_LIMITS.minSteps,
                max: ROUTE_LIMITS.maxSteps,
              }),
            )
            .join(', '),
        })
      : isPrivate
        ? t('invites.privateFirst')
        : null;
  const canCreate = !hidden && blocker === null;
  const isEmpty = invites.data?.length === 0;

  function closeCreator() {
    setCreating(false);
  }

  return (
    <div className="invites">
      {hidden && (
        <div className="route-notice editor-notice" role="note">
          <Icon name="alert" size={18} />
          <div>
            <strong>{t('editor.hidden.title')}</strong>
            {reason && <p>{t('editor.hidden.reason', { reason })}</p>}
            <p>{t('share.hidden')}</p>
          </div>
        </div>
      )}

      <header className="invites-head">
        <h2>{t('invites.title')}</h2>
        {/* An empty list has its own button: two would be one too many. */}
        {!hidden && !isEmpty && (
          <button
            type="button"
            ref={newButton}
            className="btn btn-primary"
            disabled={!canCreate}
            onClick={() => setCreating(true)}
          >
            {t('invites.new')}
          </button>
        )}
      </header>

      {blocker && (
        <p className="invites-blocker">
          <Icon name="alert" size={16} />
          {blocker} <Link to={shareTo}>{t('share.title')}</Link>
        </p>
      )}

      {/* Wide screens: the form opens in the page, above the list. */}
      {creating && wide && (
        <section
          ref={panelRef}
          tabIndex={-1}
          aria-labelledby={`${panelId}-title`}
          className="card card-pad invite-panel"
        >
          <h3 id={`${panelId}-title`}>{t('invites.new')}</h3>
          <InviteCreator
            routeId={route.id}
            routeTitle={route.title}
            onCreated={(invite) => {
              setFreshId(invite.id);
              announce(invite);
            }}
            onDone={() => {
              closeCreator();
              newButton.current?.focus();
            }}
          />
        </section>
      )}

      {invites.isPending && (
        <div className="invite-skeleton" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="skel" style={{ height: '64px' }} />
          ))}
          <p className="visually-hidden" role="status">
            {t('common.loading')}
          </p>
        </div>
      )}
      {invites.isError && (
        <ErrorBox
          message={errorMessage(t, invites.error)}
          onRetry={() => void invites.refetch()}
        />
      )}
      {isEmpty && (
        <EmptyState
          strip
          title={t('invites.empty.title')}
          text={t('invites.empty.body')}
        >
          {canCreate && (
            <button
              type="button"
              ref={newButton}
              className="btn btn-primary"
              onClick={() => setCreating(true)}
            >
              {t('invites.new')}
            </button>
          )}
        </EmptyState>
      )}
      {invites.data && invites.data.length > 0 && (
        <InviteList
          routeId={route.id}
          invites={invites.data}
          freshId={freshId}
        />
      )}

      {/* Phones: a sheet from the bottom; the focus goes back to the button. */}
      <AnimatePresence onExitComplete={() => newButton.current?.focus()}>
        {creating && !wide && (
          <InviteSheet onClose={closeCreator}>
            <InviteCreator
              routeId={route.id}
              routeTitle={route.title}
              onCreated={(invite) => setFreshId(invite.id)}
              onDone={closeCreator}
            />
          </InviteSheet>
        )}
      </AnimatePresence>
    </div>
  );
}

function InviteList({
  routeId,
  invites,
  freshId,
}: {
  routeId: string;
  invites: Invite[];
  freshId: string | null;
}) {
  const { t } = useTranslation();
  const revoke = useRevokeInvite(routeId);
  // The row asking "Revoke? Yes / No", one at a time.
  const [confirming, setConfirming] = useState<string | null>(null);
  const sorted = sortInvites(invites);

  return (
    <>
      <ul className="invite-list">
        {sorted.map((invite) => (
          <InviteRow
            key={invite.id}
            invite={invite}
            fresh={invite.id === freshId}
            confirming={confirming === invite.id}
            onAsk={() => setConfirming(invite.id)}
            onCancel={() => setConfirming(null)}
            onRevoke={() => {
              setConfirming(null);
              revoke.mutate(invite.id);
            }}
          />
        ))}
      </ul>
      {revoke.isError && (
        <p className="form-error" role="alert">
          {errorMessage(t, revoke.error)}
        </p>
      )}
    </>
  );
}

function InviteRow({
  invite,
  fresh,
  confirming,
  onAsk,
  onCancel,
  onRevoke,
}: {
  invite: Invite;
  fresh: boolean;
  confirming: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onRevoke: () => void;
}) {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const day = (iso: string) => formatDay(iso, i18n.language, now);
  const askRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  const rowRef = useRef<HTMLLIElement>(null);

  // The safe answer has the focus; going back puts it on "Revoke" again.
  useEffect(() => {
    if (confirming) {
      noRef.current?.focus();
      asked.current = true;
    } else if (asked.current) {
      asked.current = false;
      askRef.current?.focus();
    }
  }, [confirming]);

  const uses =
    invite.maxUses === null
      ? t('invites.usesCount', { count: invite.usesCount })
      : t('invites.usesOf', { used: invite.usesCount, max: invite.maxUses });
  const expiry =
    invite.status === 'revoked' && invite.revokedAt
      ? t('invites.revokedOn', { date: day(invite.revokedAt) })
      : invite.expiresAt === null
        ? t('invites.noExpiry')
        : invite.status === 'expired'
          ? t('invites.expiredOn', { date: day(invite.expiresAt) })
          : t('invites.expiresOn', { date: day(invite.expiresAt) });

  return (
    <li
      ref={rowRef}
      tabIndex={-1}
      className="invite-row"
      data-status={invite.status}
      data-fresh={fresh}
    >
      <span className="invite-chip" data-status={invite.status}>
        <Icon name={STATUS_ICON[invite.status]} size={14} />
        {t(`invites.status.${invite.status}`)}
      </span>
      <span className="invite-uses">{uses}</span>
      <span className="invite-expiry">{expiry}</span>
      <span className="invite-created">
        {t('invites.createdOn', { date: day(invite.createdAt) })}
      </span>
      <span className="invite-row-actions">
        {invite.status === 'active' &&
          (confirming ? (
            <span className="invite-confirm" role="group">
              <span>{t('invites.revokeConfirm')}</span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  // The button is about to disappear: the focus stays in the row.
                  asked.current = false;
                  rowRef.current?.focus();
                  onRevoke();
                }}
              >
                {t('editor.films.yes')}
              </button>
              <button
                type="button"
                ref={noRef}
                className="btn btn-ghost btn-sm"
                onClick={onCancel}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') onCancel();
                }}
              >
                {t('editor.films.no')}
              </button>
            </span>
          ) : (
            <button
              type="button"
              ref={askRef}
              className="btn btn-ghost btn-sm"
              onClick={onAsk}
            >
              {t('invites.revoke')}
            </button>
          ))}
      </span>
    </li>
  );
}
