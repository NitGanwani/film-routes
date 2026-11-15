import * as m from 'motion/react-m';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** How the sheet moves: the same as the others. */
const SHEET_TRANSITION = { duration: 0.26, ease: [0.22, 1, 0.36, 1] } as const;

/**
 * The bottom sheet of "New link" on phones. A native <dialog> in the layer
 * and panel of the other sheets; what goes inside is the same form the wide
 * screens show in the page.
 */
export function InviteSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
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
        className="sheet-panel invite-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={SHEET_TRANSITION}
      >
        <div className="invite-sheet-body">
          <div className="grab" aria-hidden="true" />
          <h2 id={titleId}>{t('invites.new')}</h2>
          {children}
        </div>
      </m.div>
    </dialog>
  );
}
