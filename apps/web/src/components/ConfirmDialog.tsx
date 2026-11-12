import * as m from 'motion/react-m';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

/** The same fade for the dim and the panel: nothing slides, nothing bounces. */
const FADE = { duration: 0.18, ease: 'easeOut' } as const;

type Props = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** The confirm button is drawn as a danger button. */
  danger?: boolean;
  /** Work in progress: both buttons wait and the dialog does not close. */
  pending?: boolean;
  /** An error from the server, already translated. */
  error?: string | null;
  /**
   * When set, the confirm button waits until this is typed: a label, the text
   * that must be typed, and a way to say how it was written (for the helper).
   */
  typeToConfirm?: { label: string; expected: string; matches: boolean };
  onTyped?: (value: string) => void;
  typed?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

/**
 * A question with two answers, in the dialog of the close sheet: from the
 * bottom on a phone, a card in the middle on a wide screen. A native
 * <dialog>, so the focus is trapped, Esc closes it and the page is dimmed.
 * The focus starts on the safe button (or on the field that asks for a title).
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  pending = false,
  error = null,
  typeToConfirm,
  typed = '',
  onTyped,
  onConfirm,
  onCancel,
  children,
}: Props) {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    // Guarded: in development React runs effects twice, and opening an open
    // dialog throws.
    if (dialog && !dialog.open) {
      dialog.showModal();
      // showModal() starts on the first button, which here is the dangerous
      // one: the focus goes to the safe answer, or to the field to type in.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
  }, []);

  const blocked = typeToConfirm ? !typeToConfirm.matches : false;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (blocked) {
      setAttempted(true);
      return;
    }
    onConfirm();
  }

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
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
        transition={FADE}
      />
      <m.div
        className="sheet-panel confirm-panel"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={FADE}
      >
        <form onSubmit={submit}>
          <div className="grab" aria-hidden="true" />
          <h2 id={titleId} className="confirm-title">
            {title}
          </h2>
          <p id={bodyId} className="confirm-body">
            {body}
          </p>
          {children}

          {typeToConfirm && (
            <div className={`field${attempted && blocked ? ' invalid' : ''}`}>
              <label htmlFor={`${titleId}-typed`}>{typeToConfirm.label}</label>
              <input
                id={`${titleId}-typed`}
                className="input"
                type="text"
                value={typed}
                data-autofocus
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-describedby={`${titleId}-expected`}
                onChange={(event) => onTyped?.(event.target.value)}
              />
              <p id={`${titleId}-expected`} className="hint confirm-expected">
                {typeToConfirm.expected}
              </p>
            </div>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="confirm-actions">
            <button
              type="submit"
              className={`btn btn-block ${danger ? 'btn-danger' : 'btn-primary'}`}
              aria-disabled={blocked || pending}
              disabled={pending}
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              // The safe answer has the focus when nothing has to be typed.
              data-autofocus={typeToConfirm ? undefined : true}
              className="btn btn-ghost btn-block"
              onClick={onCancel}
              disabled={pending}
            >
              {cancelLabel}
            </button>
          </div>
        </form>
      </m.div>
    </dialog>
  );
}
