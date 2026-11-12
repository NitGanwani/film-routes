import { useSyncExternalStore } from 'react';

/** Follows a CSS media query, e.g. `(min-width: 1100px)`: true while it matches. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
