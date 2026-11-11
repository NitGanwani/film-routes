import { EMOTIONS, ROUTE_LIMITS } from '@film-routes/shared';
import * as m from 'motion/react-m';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CloseStepBody, JourneyStep } from '../api/types.js';
import { Icon } from '../components/Icon.js';
import { Poster } from '../components/Poster.js';
import { filmTitle, originalTitleNote } from '../films/titles.js';
import { closeBody, closeFormProblem, type CloseForm } from './model.js';

/** How the sheet and its backdrop move: quick, and easing out like something settling. */
const SHEET_TRANSITION = { duration: 0.26, ease: [0.22, 1, 0.36, 1] } as const;

type Props = {
  step: JourneyStep;
  total: number;
  author: string;
  initialSeenBefore: boolean;
  pending: boolean;
  /** An error from the server, already translated. */
  error: string | null;
  onSubmit: (body: CloseStepBody) => void;
  onCancel: () => void;
};

/**
 * Closing a film: how it was seen, one emotion (required) and a short comment.
 * A native <dialog>, so the browser traps the focus, closes on Esc and dims the
 * page; on a phone it is a sheet from the bottom, on a wide screen a card.
 */
export function CloseDialog({
  step,
  total,
  author,
  initialSeenBefore,
  pending,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const { t, i18n } = useTranslation();
  const shownTitle = filmTitle(step.film, i18n.language);
  const originalTitle = originalTitleNote(step.film, shownTitle);
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<CloseForm>({
    emotion: null,
    comment: '',
    seenBefore: initialSeenBefore,
  });
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    // Guarded: in development React runs effects twice, and opening an open
    // dialog throws.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const problem = closeFormProblem(form);
  const problemText =
    problem === 'emotion_required'
      ? t('journey.closeForm.problemEmotion')
      : problem === 'comment_too_long'
        ? t('journey.closeForm.problemComment')
        : null;
  // The comment limit is shown as you type; a missing emotion only after trying.
  const shownProblem =
    problem === 'comment_too_long' || attempted ? problemText : null;
  const commentLength = form.comment.trim().length;

  function submit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    const body = closeBody(form);
    if (body) onSubmit(body);
  }

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: close through our own state so the page and the dialog agree.
        event.preventDefault();
        if (!pending) onCancel();
      }}
    >
      {/* The dimmed backdrop is drawn here (the native ::backdrop cannot be
          animated): it fades, and a click on it closes the sheet. */}
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
      {/* The sheet comes up from the bottom and goes back down on closing. */}
      <m.div
        className="sheet-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SHEET_TRANSITION}
      >
        <form onSubmit={submit}>
          <div className="grab" aria-hidden="true" />
          <div className="film">
            <Poster url={step.film.posterUrl} />
            <div>
              <h2 id={titleId}>
                {shownTitle}
                {originalTitle && <span className="orig">{originalTitle}</span>}
              </h2>
              <p>
                {t('journey.closeForm.position', {
                  position: step.position,
                  total,
                })}
              </p>
            </div>
          </div>

          <fieldset>
            <legend>{t('journey.closeForm.how')}</legend>
            <div className="seg">
              {([false, true] as const).map((seenBefore) => (
                <label key={String(seenBefore)}>
                  <input
                    className="visually-hidden"
                    type="radio"
                    name="seenBefore"
                    checked={form.seenBefore === seenBefore}
                    onChange={() => setForm({ ...form, seenBefore })}
                  />
                  {t(seenBefore ? 'journey.closeSeen' : 'journey.closeWatched')}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>
              {t('journey.closeForm.emotion')}{' '}
              <small>{t('journey.closeForm.emotionHint')}</small>
            </legend>
            <div className="emo-grid">
              {EMOTIONS.map((emotion) => (
                // The chosen tile swells a little under the finger.
                <m.label
                  key={emotion}
                  className="emo-opt emo"
                  data-emo={emotion}
                  whileTap={{ scale: 1.04 }}
                  transition={{ duration: 0.12 }}
                >
                  <input
                    className="visually-hidden"
                    type="radio"
                    name="emotion"
                    value={emotion}
                    checked={form.emotion === emotion}
                    onChange={() => setForm({ ...form, emotion })}
                  />
                  <Icon name={emotion} size={26} />
                  {t(`emotions.${emotion}`)}
                </m.label>
              ))}
            </div>
          </fieldset>

          <div
            className={`field${problem === 'comment_too_long' ? ' invalid' : ''}`}
          >
            <label htmlFor={`${titleId}-comment`}>
              {t('journey.closeForm.comment', { author })}{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                {t('journey.closeForm.optional')}
              </span>
            </label>
            <textarea
              id={`${titleId}-comment`}
              className="input"
              rows={3}
              value={form.comment}
              aria-describedby={`${titleId}-count`}
              onChange={(event) =>
                setForm({ ...form, comment: event.target.value })
              }
            />
            <div
              className={`counter${commentLength > ROUTE_LIMITS.commentMaxLength ? ' over' : ''}`}
            >
              <span>{t('journey.closeForm.commentHint', { author })}</span>
              <span id={`${titleId}-count`} aria-live="polite">
                {commentLength}/{ROUTE_LIMITS.commentMaxLength}
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
            {pending
              ? t('journey.closeForm.submitting')
              : t('journey.closeForm.submit')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={onCancel}
            disabled={pending}
          >
            {t('journey.cancel')}
          </button>
          <p className="note" style={{ textAlign: 'center' }}>
            {t('journey.closeForm.after', { author })}
          </p>
        </form>
      </m.div>
    </dialog>
  );
}
