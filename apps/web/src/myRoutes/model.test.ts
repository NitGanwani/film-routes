import { ROUTE_VISIBILITIES } from '@film-routes/shared';
import { describe, expect, it } from 'vitest';
import { missingFilms, VISIBILITY_ICON } from './model.js';

describe('missingFilms', () => {
  it('asks for the films that are short of the minimum of three', () => {
    expect(missingFilms(0)).toBe(3);
    expect(missingFilms(1)).toBe(2);
    expect(missingFilms(2)).toBe(1);
  });

  it('is zero from the minimum up, never negative', () => {
    expect(missingFilms(3)).toBe(0);
    expect(missingFilms(10)).toBe(0);
  });
});

describe('VISIBILITY_ICON', () => {
  it('has a different icon for every visibility', () => {
    const icons = ROUTE_VISIBILITIES.map(
      (visibility) => VISIBILITY_ICON[visibility],
    );
    expect(new Set(icons).size).toBe(ROUTE_VISIBILITIES.length);
  });
});
