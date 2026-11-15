import { ROUTE_VISIBILITIES } from '@film-routes/shared';
import { describe, expect, it } from 'vitest';
import { missingFilms, unfinishedRoute, VISIBILITY_ICON } from './model.js';

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

describe('unfinishedRoute', () => {
  const route = (change: object) => ({
    title: 'Ruta',
    stepCount: 5,
    hidden: false,
    ...change,
  });

  it('is the first route that is short of films (the one touched last)', () => {
    const list = [
      route({ title: 'Completa' }),
      route({ title: 'Reciente', stepCount: 1 }),
      route({ title: 'Antigua', stepCount: 0 }),
    ];
    expect(unfinishedRoute(list)?.title).toBe('Reciente');
  });

  it('is null when every route has enough films, or there are none', () => {
    expect(unfinishedRoute([route({ stepCount: 3 })])).toBeNull();
    expect(unfinishedRoute([])).toBeNull();
  });

  it('skips a route that was taken down or has no title', () => {
    const list = [
      route({ stepCount: 1, hidden: true }),
      route({ stepCount: 1, title: '  ' }),
      route({ stepCount: 2, title: 'Esta' }),
    ];
    expect(unfinishedRoute(list)?.title).toBe('Esta');
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
