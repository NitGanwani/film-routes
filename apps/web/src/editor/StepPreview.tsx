import * as m from 'motion/react-m';
import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { JourneyStep } from '../api/types.js';
import { StepItem } from '../journey/StepItem.js';

/** How the sheet moves: the same as the others. */
const SHEET_TRANSITION = { duration: 0.26, ease: [0.22, 1, 0.36, 1] } as const;

const noop = () => undefined;

/**
 * "How the traveler will see it": the film drawn by the real row of the
 * journey, with what the author has written so far. The note before is open
 * (they read it when they start the film); the note after is locked.
 */
export function StepPreview({
  step,
  author,
  onClose,
}: {
  step: JourneyStep;
  author: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    // Guarded: in development React runs effects twice.
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <m.div
        className="sheet-overlay"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={SHEET_TRANSITION}
      />
      <m.div
        className="sheet-panel step-preview"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SHEET_TRANSITION}
      >
        <div className="film-sheet-head">
          <div className="grab" aria-hidden="true" />
          <div className="film-sheet-bar">
            <h2 id={titleId}>{t('editor.notes.previewHeading')}</h2>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {t('editor.films.done')}
            </button>
          </div>
        </div>
        <ol className="steps step-preview-list">
          <StepItem
            step={step}
            transitionName={null}
            author={author}
            following={false}
            busy={false}
            onStart={noop}
            onOpenClose={noop}
          />
        </ol>
      </m.div>
    </dialog>
  );
}
