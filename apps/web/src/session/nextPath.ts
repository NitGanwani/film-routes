/**
 * Where to go after signing in. It comes from the address bar (`?next=`), so
 * anyone can put anything in it: only a path inside this same site is allowed.
 * Otherwise a crafted link could send a freshly signed-in person to another
 * site (an "open redirect").
 */
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/')) return '/';
  try {
    // The URL parser treats "\" like "/" and reads "//host" as another site, so
    // resolving against a dummy origin and comparing it catches both tricks.
    const base = 'http://site.invalid';
    const url = new URL(raw, base);
    if (url.origin !== base) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

/** The sign-in address that brings the person back to `path` afterwards. */
export function loginPathFor(path: string): string {
  return `/login?next=${encodeURIComponent(path)}`;
}
