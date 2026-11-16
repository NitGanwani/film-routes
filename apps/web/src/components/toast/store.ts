import {
  DURATION,
  withToast,
  withoutToast,
  type Toast,
  type ToastKind,
} from './model.js';

/**
 * The notices that are on screen. Outside React on purpose: a save that ends
 * in a mutation callback can say "saved" without a context in between, and the
 * `Toaster` listens through `useSyncExternalStore`.
 */
let toasts: readonly Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function set(next: readonly Toast[]) {
  toasts = next;
  listeners.forEach((listener) => listener());
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): readonly Toast[] {
  return toasts;
}

export type ToastInput = {
  kind: ToastKind;
  title: string;
  detail?: string;
  action?: Toast['action'];
};

/** Show a notice; returns its id. */
export function showToast(input: ToastInput): number {
  const id = nextId++;
  set(withToast(toasts, { ...input, id, duration: DURATION[input.kind] }));
  return id;
}

export function dismissToast(id: number) {
  set(withoutToast(toasts, id));
}
