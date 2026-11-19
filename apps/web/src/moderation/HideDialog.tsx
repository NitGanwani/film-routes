import { MODERATION_LIMITS } from '@film-routes/shared';
import * as m from 'motion/react-m';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  hideBody,
  hideProblem,
  type HideBody,
  type HideProblem,
} from './admin.js';

const SHEET_TRANSITION = { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] } as const;

type Props = {
  pending: boolean;
  /** An error from the server, already translated. */
  error: string | null;
  onSubmit: (body: HideBody) => void;
  onCancel: () => void;
};

const PROBLEM_TEXT: Record<HideProblem, string> = {
  reason_required: 'hide.problemRequired',
  reason_too_long: 'hide.problemTooLong',
};

/**
 * Taking a route down. The reason is mandatory because the author reads it
 * and needs to know what to fix. A native <dialog>, like the other sheets.
 */
export function HideDialog({ pending, error, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    // Guarded: in development React runs effects twice, and opening an open
    // dialog throws.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const problem = hideProblem(reason);
  // The limit is shown as you type; a missing reason only after trying.
  const shown =
    problem === 'reason_too_long' || (attempted && problem) ? problem : null;
  const length = reason.trim().length;

  function submit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    const body = hideBody(reason);
    if (body) onSubmit(body);
  }

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
    >
      <m.div
        className="sheet-overlay"
        onClick={() => {
          if (!pending) onCancel();
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={SHEET_TRANSITION}
      />
      <m.div
        className="sheet-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SHEET_TRANSITION}
      >
        <form onSubmit={submit}>
          <div className="grab" aria-hidden="true" />
          <div>
            <h2 id={titleId}>{t('hide.title')}</h2>
            <p className="confirm-body" style={{ marginTop: 'var(--sp-2)' }}>
              {t('hide.intro')}
            </p>
          </div>

          <div className={`field${shown ? ' invalid' : ''}`}>
            <label htmlFor={`${titleId}-reason`}>{t('hide.reason')}</label>
            <textarea
              id={`${titleId}-reason`}
              className="input"
              rows={4}
              value={reason}
              aria-describedby={`${titleId}-count`}
              onChange={(event) => setReason(event.target.value)}
            />
            <div
              className={`counter${length > MODERATION_LIMITS.hideReasonMaxLength ? ' over' : ''}`}
            >
              <span />
              <span id={`${titleId}-count`} aria-live="polite">
                {length}/{MODERATION_LIMITS.hideReasonMaxLength}
              </span>
            </div>
          </div>

          {shown && (
            <p className="form-error" role="alert">
              {t(PROBLEM_TEXT[shown])}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={pending}
          >
            {pending ? t('hide.submitting') : t('hide.submit')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={onCancel}
            disabled={pending}
          >
            {t('hide.cancel')}
          </button>
        </form>
      </m.div>
    </dialog>
  );
}
