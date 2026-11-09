import { describe, expect, it } from 'vitest';
import { loginPathFor, safeNextPath } from './nextPath.js';

describe('safeNextPath', () => {
  it('keeps a path inside the site, with its query and hash', () => {
    expect(safeNextPath('/routes/abc')).toBe('/routes/abc');
    expect(safeNextPath('/journeys?x=1#top')).toBe('/journeys?x=1#top');
  });

  it('falls back to the home page when there is nothing', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath('')).toBe('/');
  });

  it.each([
    ['another site', 'https://evil.example/steal'],
    ['protocol-relative', '//evil.example'],
    // With a path after the host, ignoring the host would still leave a
    // plausible-looking path behind: it must be refused outright instead.
    ['protocol-relative with a path', '//evil.example/steal'],
    ['backslash trick', '/\\evil.example'],
    ['backslash trick with a path', '/\\evil.example/steal'],
    ['tab-separated slashes', '/\t/evil.example'],
    ['javascript url', 'javascript:alert(1)'],
    ['relative path', 'routes/abc'],
    ['data url', 'data:text/html,hi'],
  ])('refuses %s', (_name, raw) => {
    expect(safeNextPath(raw)).toBe('/');
  });
});

describe('safeNextPath: what comes back is what was checked', () => {
  it('returns the normalised path, not the text as typed', () => {
    expect(safeNextPath('/a/../b')).toBe('/b');
    // The URL parser drops tabs and newlines, so the typed text and the
    // checked text differ here; only the checked one may be used.
    expect(safeNextPath('/\tfoo')).toBe('/foo');
  });
});

describe('loginPathFor', () => {
  it('encodes the way back so it survives as one value', () => {
    const login = loginPathFor('/routes/abc?x=1&y=2');
    const next = new URL(login, 'http://site.invalid').searchParams.get('next');
    expect(next).toBe('/routes/abc?x=1&y=2');
  });

  it('round-trips through safeNextPath', () => {
    const path = '/routes/abc?x=1&y=2';
    const next = new URL(
      loginPathFor(path),
      'http://site.invalid',
    ).searchParams.get('next');
    expect(safeNextPath(next)).toBe(path);
  });
});
