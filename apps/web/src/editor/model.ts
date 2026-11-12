import { ROUTE_LIMITS } from '@film-routes/shared';

/** How long to wait after the last key before saving on its own. */
export const AUTOSAVE_DELAY_MS = 800;

export type Problem = 'required' | 'tooLong';

/** What is counted: the text without the spaces around it, which is what the API keeps. */
export const measure = (value: string) => value.trim().length;

export function titleProblem(value: string): Problem | null {
  const length = measure(value);
  if (length === 0) return 'required';
  return length > ROUTE_LIMITS.titleMaxLength ? 'tooLong' : null;
}

/** The description is optional: empty is fine, too long is not. */
export function descriptionProblem(value: string): Problem | null {
  return measure(value) > ROUTE_LIMITS.descriptionMaxLength ? 'tooLong' : null;
}

/**
 * The character counter stays out of the way until it matters: it appears at
 * 80 % of the limit, warns at the limit and complains past it.
 */
export type CounterLevel = 'hidden' | 'near' | 'full' | 'over';

export function counterLevel(length: number, max: number): CounterLevel {
  if (length > max) return 'over';
  if (length === max) return 'full';
  // length >= 80 % of max, in whole numbers (no 0.8 * 120 rounding to worry about).
  return length * 5 >= max * 4 ? 'near' : 'hidden';
}

/** The fields the editor saves by themselves. */
export type RoutePatch = { title?: string; description?: string | null };
export type Draft = { title: string; description: string };
export type Saved = { title: string; description: string | null };

/**
 * What to send: only the fields that changed and are valid. A field with a
 * problem is held back (the message under it says why) without stopping the
 * other one from being saved. An empty description clears it (`null`).
 */
export function routePatch(saved: Saved, draft: Draft): RoutePatch {
  const patch: RoutePatch = {};
  if (titleProblem(draft.title) === null) {
    const title = draft.title.trim();
    if (title !== saved.title) patch.title = title;
  }
  if (descriptionProblem(draft.description) === null) {
    const description = draft.description.trim() || null;
    if (description !== saved.description) patch.description = description;
  }
  return patch;
}

/** The route as it will be once the patch is saved (for the optimistic update). */
export function applyPatch<T extends Saved>(route: T, patch: RoutePatch): T {
  return { ...route, ...patch };
}
