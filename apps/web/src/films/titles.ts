import type { Film } from '../api/types.js';

/** The film's title in the viewer's language (the route's own if unknown). */
export function filmTitle(
  film: Pick<Film, 'title' | 'titles'>,
  language: string,
): string {
  return language === 'en' || language === 'es'
    ? film.titles[language]
    : film.title;
}

/**
 * The original title, when it adds something: a Spanish reader sees "El
 * resplandor" and also "The Shining". Null when it is the same as what is
 * already shown (ignoring case and spacing).
 */
export function originalTitleNote(
  film: Pick<Film, 'originalTitle'>,
  shown: string,
): string | null {
  const same = (a: string, b: string) =>
    a.trim().toLowerCase() === b.trim().toLowerCase();
  return same(film.originalTitle, shown) ? null : film.originalTitle;
}
