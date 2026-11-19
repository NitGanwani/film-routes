import {
  MODERATION_LIMITS,
  REPORT_REASONS,
  type ReportReason,
} from '@film-routes/shared';
import * as m from 'motion/react-m';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon.js';
import {
  REASON_ICON,
  reportBody,
  reportProblem,
  type ReportBody,
  type ReportForm,
} from './report.js';

const SHEET_TRANSITION = { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] } as const;

type Props = {
  pending: boolean;
  /** An error from the server, already translated. */
  error: string | null;
  onSubmit: (body: ReportBody) => void;
  onCancel: () => void;
};

/**
 * Reporting a route: why (one of four, each with its drawing and its words)
 * and, if the person wants, a few words more. A native <dialog>, like the
 * other sheets: the focus stays inside, Esc closes it, the page is dimmed.
 */
export function ReportDialog({ pending, error, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<ReportForm>({ reason: null, note: '' });
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    // Guarded: in development React runs effects twice, and opening an open
    // dialog throws.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const problem = reportProblem(form);
  const problemText =
    problem === 'reason_required'
      ? t('report.problemReason')
      : problem === 'note_too_long'
        ? t('report.problemNote')
        : null;
  // The note limit is shown as you type; a missing reason only after trying.
  const shownProblem =
    problem === 'note_too_long' || attempted ? problemText : null;
  const noteLength = form.note.trim().length;

  function submit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    const body = reportBody(form);
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
            <h2 id={titleId}>{t('report.title')}</h2>
            <p className="confirm-body" style={{ marginTop: 'var(--sp-2)' }}>
              {t('report.intro')}
            </p>
          </div>

          <fieldset>
            <legend>{t('report.reason')}</legend>
            <div className="report-reasons">
              {REPORT_REASONS.map((reason: ReportReason) => (
                <label key={reason} className="report-reason">
                  <input
                    className="visually-hidden"
                    type="radio"
                    name="reason"
                    value={reason}
                    checked={form.reason === reason}
                    onChange={() => setForm({ ...form, reason })}
                  />
                  <Icon name={REASON_ICON[reason]} size={22} />
                  <span className="report-reason-text">
                    <strong>{t(`report.reasons.${reason}.title`)}</strong>
                    <span>{t(`report.reasons.${reason}.text`)}</span>
                  </span>
                  <span className="report-reason-tick" aria-hidden="true">
                    <Icon name="check" size={16} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div
            className={`field${problem === 'note_too_long' ? ' invalid' : ''}`}
          >
            <label htmlFor={`${titleId}-note`}>
              {t('report.note')}{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                {t('report.optional')}
              </span>
            </label>
            <textarea
              id={`${titleId}-note`}
              className="input"
              rows={3}
              value={form.note}
              aria-describedby={`${titleId}-count`}
              onChange={(event) =>
                setForm({ ...form, note: event.target.value })
              }
            />
            <div
              className={`counter${noteLength > MODERATION_LIMITS.reportNoteMaxLength ? ' over' : ''}`}
            >
              <span />
              <span id={`${titleId}-count`} aria-live="polite">
                {noteLength}/{MODERATION_LIMITS.reportNoteMaxLength}
              </span>
            </div>
          </div>

          {shownProblem && (
            <p className="form-error" role="alert">
              {shownProblem}
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
            {pending ? t('report.submitting') : t('report.submit')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={onCancel}
            disabled={pending}
          >
            {t('report.cancel')}
          </button>
        </form>
      </m.div>
    </dialog>
  );
}
