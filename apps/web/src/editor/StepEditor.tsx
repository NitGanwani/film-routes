import { ROUTE_LIMITS } from '@film-routes/shared';
import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthorStep } from '../api/types.js';
import { EmotionPicker } from '../components/EmotionPicker.js';
import { FieldFeedback } from '../components/FieldFeedback.js';
import { Icon } from '../components/Icon.js';
import { noteProblem } from './notes.js';
import { useAutosize } from './useAutosize.js';
import type { NoteField, useStepNotes } from './useStepNotes.js';

type Notes = ReturnType<typeof useStepNotes>;

type CardProps = {
  step: AuthorStep;
  notes: Notes;
  field: NoteField;
};

/**
 * One of the two notes. "Before" is a plain card with an open eye: the traveler
 * reads it right before the film. "After" is drawn like the locked content of
 * the journey (the same class, dashed): it stays shut until they close the film.
 * So the author sees what the traveler will see.
 */
function NoteCard({ step, notes, field }: CardProps) {
  const { t } = useTranslation();
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const kind = field === 'noteBefore' ? 'before' : 'after';
  const value = notes.draft(step)[field];
  const problem = noteProblem(value);
  useAutosize(ref, value);

  return (
    <section
      className={kind === 'after' ? 'note-card locked' : 'note-card'}
      data-kind={kind}
      aria-labelledby={`${id}-title`}
    >
      <header className="note-card-head">
        <Icon name={kind === 'before' ? 'eye' : 'lock'} size={20} />
        <h4 id={`${id}-title`}>{t(`editor.notes.${kind}.title`)}</h4>
      </header>
      <p className="note-card-label">{t(`editor.notes.${kind}.label`)}</p>
      <p className="note-card-hint" id={`${id}-hint`}>
        {t(`editor.notes.${kind}.hint`)}
      </p>
      <div className={problem ? 'field invalid' : 'field'}>
        <textarea
          ref={ref}
          className="input autosize"
          rows={3}
          value={value}
          aria-labelledby={`${id}-title`}
          aria-invalid={problem !== null}
          aria-describedby={`${id}-hint${problem ? ` ${id}-error` : ''}`}
          placeholder={t(`editor.notes.${kind}.placeholder`)}
          onChange={(event) => notes.setNote(step, field, event.target.value)}
          onBlur={() => notes.flush(step)}
        />
        <FieldFeedback
          id={id}
          problem={problem}
          value={value}
          max={ROUTE_LIMITS.noteMaxLength}
        />
      </div>
    </section>
  );
}

/**
 * Everything the author writes about one film: the two notes side by side (one
 * under the other on a phone), their own emotion under them, and a way to see
 * the film as the traveler will.
 */
export function StepEditor({
  step,
  notes,
  onPreview,
}: {
  step: AuthorStep;
  notes: Notes;
  onPreview: (trigger: HTMLButtonElement) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const draft = notes.draft(step);

  return (
    <div className="step-editor">
      <div className="note-cards">
        <NoteCard step={step} notes={notes} field="noteBefore" />
        <NoteCard step={step} notes={notes} field="noteAfter" />
      </div>

      <fieldset className="step-emotion">
        <legend id={`${id}-emotion`}>{t('editor.emotion.title')}</legend>
        <p className="hint" id={`${id}-emotion-hint`}>
          {t('editor.emotion.hint')}
        </p>
        <EmotionPicker
          name={`${id}-emotion`}
          value={draft.emotion}
          labelledBy={`${id}-emotion`}
          describedBy={`${id}-emotion-hint`}
          onChange={(emotion) => notes.setEmotion(step, emotion)}
          none={{
            label: t('editor.emotion.unknown'),
            onChoose: () => notes.setEmotion(step, null),
          }}
        />
      </fieldset>

      <button
        type="button"
        className="btn btn-secondary step-preview-btn"
        onClick={(event) => onPreview(event.currentTarget)}
      >
        <Icon name="eye" size={18} />
        {t('editor.notes.preview')}
      </button>
    </div>
  );
}
