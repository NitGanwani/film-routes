/** The four voices of a notice, each with its own icon and way of leaving. */
export type ToastKind = 'changes' | 'copied' | 'invite' | 'error';

export type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  /** What the notice offers to do next ("Undo", "Copy link", "Retry"). */
  action?: { label: string; run: () => void };
  /** How long it stays, in ms. `null` = until it is closed (errors). */
  duration: number | null;
};

/** At most two notices at once: a third would be noise. */
export const MAX_TOASTS = 2;

/** How long each kind stays: longer when it carries an action. */
export const DURATION: Record<ToastKind, number | null> = {
  changes: 6000,
  copied: 5000,
  invite: 8000,
  error: null,
};

/** After hovering or focusing, never leave in less than this. */
export const MIN_AFTER_RESUME = 1500;

/**
 * The list after a new notice comes in. One of the same kind is replaced (copy
 * twice and there is one "Link copied", not two), and an error only ever
 * shares the screen with nothing older of its kind; past the limit the oldest
 * goes.
 */
export function withToast(
  list: readonly Toast[],
  incoming: Toast,
  max = MAX_TOASTS,
): Toast[] {
  const kept = list.filter((toast) => toast.kind !== incoming.kind);
  return [...kept, incoming].slice(-max);
}

/** The list without one notice. */
export function withoutToast(list: readonly Toast[], id: number): Toast[] {
  return list.filter((toast) => toast.id !== id);
}

/** What is left of a notice's time once the pointer or the focus leaves it. */
export function timeAfterResume(left: number): number {
  return Math.max(left, MIN_AFTER_RESUME);
}
