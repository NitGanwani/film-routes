import { describe, expect, it } from 'vitest';
import {
  canChoose,
  deleteNeedsTitle,
  needsShareWarning,
  shareLink,
  shareRequirements,
  titleMatches,
} from './share.js';

describe('shareRequirements', () => {
  it('is met with 3 to 10 films and a confirmed email', () => {
    expect(shareRequirements({ stepCount: 3, emailVerified: true })).toEqual({
      count: 3,
      filmsOk: true,
      emailOk: true,
      missing: [],
    });
    expect(
      shareRequirements({ stepCount: 10, emailVerified: true }).missing,
    ).toEqual([]);
  });

  it('lists what is missing, films first', () => {
    expect(
      shareRequirements({ stepCount: 2, emailVerified: false }).missing,
    ).toEqual(['films', 'email']);
    expect(
      shareRequirements({ stepCount: 5, emailVerified: false }).missing,
    ).toEqual(['email']);
    expect(
      shareRequirements({ stepCount: 0, emailVerified: true }).missing,
    ).toEqual(['films']);
  });
});

describe('canChoose', () => {
  const lacking = shareRequirements({ stepCount: 1, emailVerified: false });
  const ready = shareRequirements({ stepCount: 4, emailVerified: true });

  it('always allows going back to private', () => {
    expect(canChoose('private', lacking)).toBe(true);
  });

  it('allows sharing only when nothing is missing', () => {
    expect(canChoose('unlisted', lacking)).toBe(false);
    expect(canChoose('public', lacking)).toBe(false);
    expect(canChoose('unlisted', ready)).toBe(true);
    expect(canChoose('public', ready)).toBe(true);
  });
});

describe('needsShareWarning', () => {
  it('warns when a free route goes from private to shared', () => {
    expect(
      needsShareWarning({ current: 'private', next: 'public', locked: false }),
    ).toBe(true);
    expect(
      needsShareWarning({
        current: 'private',
        next: 'unlisted',
        locked: false,
      }),
    ).toBe(true);
  });

  it('does not warn for anything else', () => {
    expect(
      needsShareWarning({ current: 'unlisted', next: 'public', locked: false }),
    ).toBe(false);
    expect(
      needsShareWarning({ current: 'public', next: 'private', locked: false }),
    ).toBe(false);
    expect(
      needsShareWarning({ current: 'private', next: 'public', locked: true }),
    ).toBe(false);
  });
});

describe('shareLink', () => {
  it('is the public page of the route', () => {
    expect(shareLink('https://film-routes.test', 'abc')).toBe(
      'https://film-routes.test/routes/abc',
    );
  });
});

describe('deleting', () => {
  it('asks for the title only when the route has 3 films or more', () => {
    expect(deleteNeedsTitle(0)).toBe(false);
    expect(deleteNeedsTitle(2)).toBe(false);
    expect(deleteNeedsTitle(3)).toBe(true);
  });

  it('compares the title without the spaces around or repeated inside', () => {
    expect(titleMatches('  Ruta   de prueba ', 'Ruta de prueba')).toBe(true);
    expect(titleMatches('ruta de prueba', 'Ruta de prueba')).toBe(false);
    expect(titleMatches('', 'Ruta de prueba')).toBe(false);
  });
});
