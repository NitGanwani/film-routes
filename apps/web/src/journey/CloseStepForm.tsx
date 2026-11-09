import { EMOTIONS, ROUTE_LIMITS } from '@film-routes/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CloseStepBody, JourneyStep } from '../api/types.js';
import { closeBody, closeFormProblem, type CloseForm } from './model.js';

type Props = {
  step: JourneyStep;
  author: string;
  initialSeenBefore: boolean;
  pending: boolean;
  /** An error from the server, already translated. */
  error: string | null;
  onSubmit: (body: CloseStepBody) => void;
  onCancel: () => void;
};

/** Closing a film: how it was seen, one emotion (required), a short comment. */
export function CloseStepForm({
  step,
  author,
  initialSeenBefore,
  pending,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CloseForm>({
    emotion: null,
    comment: '',
    seenBefore: initialSeenBefore,
  });
  const [attempted, setAttempted] = useState(false);

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

  function submit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    const body = closeBody(form);
    if (body) onSubmit(body);
  }

  return (
    <form
      onSubmit={submit}
      aria-label={t('journey.closeForm.title', { film: step.film.title })}
    >
      <h3>{t('journey.closeForm.title', { film: step.film.title })}</h3>
      <fieldset>
        <legend>{t('journey.closeForm.how')}</legend>
        {([false, true] as const).map((seenBefore) => (
          <label key={String(seenBefore)}>
            <input
              type="radio"
              name="seenBefore"
              checked={form.seenBefore === seenBefore}
              onChange={() => setForm({ ...form, seenBefore })}
            />
            {t(seenBefore ? 'journey.closeSeen' : 'journey.closeWatched')}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>
          {t('journey.closeForm.emotion')}{' '}
          <small>{t('journey.closeForm.emotionHint')}</small>
        </legend>
        {EMOTIONS.map((emotion) => (
          <label key={emotion} data-emotion={emotion}>
            <input
              type="radio"
              name="emotion"
              value={emotion}
              checked={form.emotion === emotion}
              onChange={() => setForm({ ...form, emotion })}
            />
            {t(`emotions.${emotion}`)}
          </label>
        ))}
      </fieldset>
      <label>
        {t('journey.closeForm.comment', { author })}
        <textarea
          rows={3}
          value={form.comment}
          onChange={(event) =>
            setForm({ ...form, comment: event.target.value })
          }
        />
      </label>
      <p aria-live="polite">
        {form.comment.trim().length}/{ROUTE_LIMITS.commentMaxLength}
      </p>
      {shownProblem && <p role="alert">{shownProblem}</p>}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending}>
        {pending
          ? t('journey.closeForm.submitting')
          : t('journey.closeForm.submit')}
      </button>{' '}
      <button type="button" onClick={onCancel} disabled={pending}>
        {t('journey.cancel')}
      </button>
      <p>{t('journey.closeForm.after', { author })}</p>
    </form>
  );
}
