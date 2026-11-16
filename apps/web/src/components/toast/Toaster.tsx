import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../Icon.js';
import { timeAfterResume, type Toast } from './model.js';
import { dismissToast, getToasts, subscribeToasts } from './store.js';
import { ToastIcon } from './ToastIcon.js';

const ENTER = { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } as const;
const LEAVE = { duration: 0.16, ease: [0.4, 0, 1, 1] } as const;

/**
 * Where the notices appear: above the bottom bar on a phone, at the corner on
 * a wide screen. One per Layout; the notices themselves come from `showToast`.
 */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  return (
    <div className="toasts">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isError = toast.kind === 'error';

  // The countdown stops while the pointer or the focus is inside and goes on
  // with what was left (never less than a second and a half).
  const timer = useRef<number | undefined>(undefined);
  const left = useRef(toast.duration ?? 0);
  const startedAt = useRef(0);
  const [paused, setPaused] = useState(false);

  const arm = (ms: number) => {
    window.clearTimeout(timer.current);
    startedAt.current = Date.now();
    timer.current = window.setTimeout(() => dismissToast(toast.id), ms);
  };
  const pause = () => {
    if (toast.duration === null || timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    left.current -= Date.now() - startedAt.current;
    setPaused(true);
  };
  const resume = () => {
    if (toast.duration === null || timer.current !== undefined) return;
    setPaused(false);
    left.current = timeAfterResume(left.current);
    arm(left.current);
  };

  useEffect(() => {
    if (toast.duration !== null) arm(toast.duration);
    return () => window.clearTimeout(timer.current);
    // Armed once per notice: a notice is a new element each time (its key).
  }, []);

  // An error asks for attention: the focus goes to what can be done about it
  // and, when the person closes the notice, comes back to where it was.
  const before = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isError) return;
    // Development runs this twice: the second time the focus is already ours.
    before.current ??= document.activeElement as HTMLElement | null;
    (actionRef.current ?? closeRef.current)?.focus({ preventScroll: true });
  }, [isError]);

  // Every way out that starts inside the notice goes through here: the focus
  // has to move before the notice's buttons are taken off the page.
  function close() {
    if (ref.current?.contains(document.activeElement)) {
      if (before.current?.isConnected) before.current.focus();
      else (document.activeElement as HTMLElement).blur();
    }
    dismissToast(toast.id);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') close();
  }

  return (
    <m.div
      ref={ref}
      className="toast"
      data-kind={toast.kind}
      data-paused={paused ? 'true' : undefined}
      role={isError ? 'alert' : 'status'}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: ENTER }}
      exit={{ opacity: 0, y: 8, transition: LEAVE }}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) resume();
      }}
      onKeyDown={onKeyDown}
    >
      <ToastIcon kind={toast.kind} />
      <div className="toast-msg">
        <strong>{toast.title}</strong>
        {toast.detail && <span>{toast.detail}</span>}
      </div>
      <div className="toast-actions">
        {toast.action && (
          <button
            ref={actionRef}
            type="button"
            className="toast-act"
            onClick={() => {
              close();
              toast.action?.run();
            }}
          >
            {toast.action.label}
          </button>
        )}
        <button
          ref={closeRef}
          type="button"
          className="toast-x"
          aria-label={t('toast.close')}
          onClick={close}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      {toast.duration !== null && (
        <div className="toast-bar" aria-hidden="true">
          <i style={{ animationDuration: `${toast.duration}ms` }} />
        </div>
      )}
    </m.div>
  );
}
