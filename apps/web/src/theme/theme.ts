export type Theme = 'light' | 'dark';

const THEME_KEY = 'film-routes.theme';

/** Anything that is not exactly "light" or "dark" is not a saved choice. */
export function parseTheme(value: unknown): Theme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

/** The other theme: what the toggle switches to. */
export function otherTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

/** What the person chose on this device, if they ever did. */
export function savedTheme(): Theme | null {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    // Storage can be blocked (private mode): act as if nothing was chosen.
    return null;
  }
}

/** What the operating system or browser asks for. */
export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Writes the choice on <html>, where the stylesheet looks for it. With no
 * choice the attribute is removed and the system setting decides (in CSS).
 */
export function applyTheme(theme: Theme | null) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

/** Remembers an explicit choice. */
export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Not saving it is only an inconvenience: it applies until the page closes.
  }
}

/** Run once before the first paint, so the page never flashes the wrong theme. */
export function initTheme() {
  applyTheme(savedTheme());
}
