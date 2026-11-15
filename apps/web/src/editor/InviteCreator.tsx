import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateInvite } from '../api/mutations.js';
import type { CreatedInvite } from '../api/types.js';
import { errorMessage } from '../components/errorMessage.js';
import { Icon } from '../components/Icon.js';
import { useCopied } from '../components/useCopied.js';
import {
  digitsOnly,
  INVITE_LIMITS,
  initialInviteForm,
  inviteBody,
  inviteFormProblems,
  inviteLink,
  type ExpiryChoice,
  type InviteForm,
  type UsesChoice,
} from './invites.js';

type Props = {
  routeId: string;
  routeTitle: string;
  /** A link was created: the list can show it as new. */
  onCreated: (invite: CreatedInvite) => void;
  /** Leave without a link (form) or after copying it (result). */
  onDone: () => void;
};

/**
 * Making a link: how many people can use it and how long it lasts, then the
 * link itself, shown once. The same body goes in the sheet (phones) and in the
 * panel of the page (wide screens).
 */
export function InviteCreator({
  routeId,
  routeTitle,
  onCreated,
  onDone,
}: Props) {
  const { t } = useTranslation();
  const create = useCreateInvite(routeId);
  const created = create.data;

  if (created) {
    return (
      <InviteResult invite={created} routeTitle={routeTitle} onDone={onDone} />
    );
  }
  return (
    <InviteFormView
      pending={create.isPending}
      error={create.isError ? errorMessage(t, create.error) : null}
      onCancel={onDone}
      onSubmit={(body) =>
        create.mutate(body, { onSuccess: (invite) => onCreated(invite) })
      }
    />
  );
}

function InviteFormView({
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (body: NonNullable<ReturnType<typeof inviteBody>>) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [form, setForm] = useState<InviteForm>(initialInviteForm);
  const [attempted, setAttempted] = useState(false);
  const problems = inviteFormProblems(form);

  function submit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    const body = inviteBody(form);
    if (body && !pending) onSubmit(body);
  }

  const usesChoices: [UsesChoice, string][] = [
    ['unlimited', 'invites.uses.unlimited'],
    ['limited', 'invites.uses.limited'],
  ];
  const expiryChoices: [ExpiryChoice, string][] = [
    ['default', 'invites.expiry.default'],
    ['custom', 'invites.expiry.custom'],
    ['never', 'invites.expiry.never'],
  ];

  return (
    <form className="invite-form" onSubmit={submit} noValidate>
      <fieldset>
        <legend id={`${id}-uses`}>{t('invites.uses.title')}</legend>
        <div className="seg" role="radiogroup" aria-labelledby={`${id}-uses`}>
          {usesChoices.map(([value, key]) => (
            <label key={value}>
              <input
                className="visually-hidden"
                type="radio"
                name={`${id}-uses`}
                checked={form.uses === value}
                onChange={() => setForm({ ...form, uses: value })}
              />
              {t(key)}
            </label>
          ))}
        </div>
        {form.uses === 'limited' && (
          <div
            className={`field${attempted && problems.maxUses ? ' invalid' : ''}`}
          >
            <input
              className="input invite-number"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label={t('invites.uses.limited')}
              aria-invalid={attempted && problems.maxUses}
              aria-describedby={`${id}-uses-hint`}
              value={form.maxUses}
              onChange={(event) =>
                setForm({ ...form, maxUses: digitsOnly(event.target.value) })
              }
            />
            <p id={`${id}-uses-hint`} className="hint">
              {t('invites.uses.hint')}
            </p>
            {attempted && problems.maxUses && (
              <p className="form-error" role="alert">
                {t('invites.problem.uses', { max: INVITE_LIMITS.maxUses })}
              </p>
            )}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend id={`${id}-expiry`}>{t('invites.expiry.title')}</legend>
        <div
          className="seg seg-3"
          role="radiogroup"
          aria-labelledby={`${id}-expiry`}
        >
          {expiryChoices.map(([value, key]) => (
            <label key={value}>
              <input
                className="visually-hidden"
                type="radio"
                name={`${id}-expiry`}
                checked={form.expiry === value}
                onChange={() => setForm({ ...form, expiry: value })}
              />
              {value === 'default'
                ? t(key, { days: INVITE_LIMITS.defaultDays })
                : t(key)}
            </label>
          ))}
        </div>
        {form.expiry === 'custom' && (
          <div
            className={`field${attempted && problems.days ? ' invalid' : ''}`}
          >
            <div className="invite-days">
              <input
                className="input invite-number"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={t('invites.expiry.custom')}
                aria-invalid={attempted && problems.days}
                value={form.days}
                onChange={(event) =>
                  setForm({ ...form, days: digitsOnly(event.target.value) })
                }
              />
              <span>{t('invites.expiry.days')}</span>
            </div>
            {attempted && problems.days && (
              <p className="form-error" role="alert">
                {t('invites.problem.days', { max: INVITE_LIMITS.maxDays })}
              </p>
            )}
          </div>
        )}
      </fieldset>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="invite-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {t('invites.create')}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onCancel}
          disabled={pending}
        >
          {t('invites.cancel')}
        </button>
      </div>
    </form>
  );
}

/** The link, big, once: it cannot be shown again, only replaced by a new one. */
function InviteResult({
  invite,
  routeTitle,
  onDone,
}: {
  invite: CreatedInvite;
  routeTitle: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const link = inviteLink(window.location.origin, invite.token);
  const { copied, copy } = useCopied(link, () => inputRef.current?.select());
  // Where the device has a share sheet, offer it; elsewhere the button is not drawn.
  const canShare = typeof navigator.share === 'function';

  return (
    <div className="invite-result">
      <h3 id={`${id}-ready`}>{t('invites.ready')}</h3>
      <input
        ref={inputRef}
        className="input invite-link-big"
        readOnly
        aria-labelledby={`${id}-ready`}
        value={link}
        onFocus={(event) => event.currentTarget.select()}
      />
      <p className="hint">{t('invites.savedNow')}</p>
      <div className="invite-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void copy()}
        >
          {copied && <Icon name="check" size={16} />}
          <span aria-live="polite">
            {copied ? t('invites.copied') : t('invites.copy')}
          </span>
        </button>
        {canShare && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              // Cancelling the share sheet rejects: nothing to say about that.
              void navigator
                .share({ title: routeTitle, url: link })
                .catch(() => undefined)
            }
          >
            {t('invites.share')}
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          {t('invites.done')}
        </button>
      </div>
    </div>
  );
}
