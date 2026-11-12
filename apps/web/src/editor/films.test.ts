import { describe, expect, it } from 'vitest';
import type {
  AuthorRouteDetail,
  AuthorStep,
  FilmSearchResult,
} from '../api/types.js';
import {
  filmsState,
  isLockedRefusal,
  isPendingStep,
  moveItem,
  searchTerm,
  stepFromResult,
  stepKey,
  withStepAdded,
  withStepRemoved,
  withStepsOrdered,
} from './films.js';

const result = (tmdbId: number): FilmSearchResult => ({
  tmdbId,
  title: `Film ${tmdbId}`,
  originalTitle: `Original ${tmdbId}`,
  releaseYear: 2000 + tmdbId,
  posterUrl: null,
  posterUrlSmall: null,
  backdropUrl: null,
});

const step = (tmdbId: number, position: number): AuthorStep => ({
  ...stepFromResult(result(tmdbId), position),
  id: `step-${tmdbId}`,
});

const route = (...tmdbIds: number[]): AuthorRouteDetail => ({
  id: 'route-1',
  title: 'Una ruta',
  description: null,
  locale: 'es',
  visibility: 'private',
  locked: false,
  moderation: { hidden: false, hiddenAt: null, reason: null },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  steps: tmdbIds.map((id, index) => step(id, index + 1)),
});

const ids = (value: AuthorRouteDetail) => value.steps.map((s) => s.id);

describe('searchTerm', () => {
  it('waits for two letters', () => {
    expect(searchTerm('')).toBeNull();
    expect(searchTerm(' a ')).toBeNull();
    expect(searchTerm('ab')).toBe('ab');
  });

  it('trims and collapses the spaces, so one search is one cache entry', () => {
    expect(searchTerm('  big   fish ')).toBe('big fish');
  });
});

describe('filmsState', () => {
  it('asks for three films before sharing', () => {
    expect(filmsState(0).missing).toBe(3);
    expect(filmsState(2).missing).toBe(1);
    expect(filmsState(3).missing).toBe(0);
  });

  it('lets films in until there are ten', () => {
    expect(filmsState(9)).toMatchObject({ canAdd: true, full: false });
    expect(filmsState(10)).toMatchObject({ canAdd: false, full: true });
  });
});

describe('stepFromResult', () => {
  it('is marked as not saved yet, and keeps its key from film to film', () => {
    const added = stepFromResult(result(7), 4);
    expect(isPendingStep(added)).toBe(true);
    expect(isPendingStep(step(7, 4))).toBe(false);
    expect(added.position).toBe(4);
    // The same key before and after the server answers: the row is not remounted.
    expect(stepKey(added)).toBe(stepKey(step(7, 4)));
  });
});

describe('withStepAdded', () => {
  it('puts the film last', () => {
    const next = withStepAdded(route(1, 2), result(3));
    expect(next.steps.map((s) => s.film.tmdbId)).toEqual([1, 2, 3]);
    expect(next.steps[2]?.position).toBe(3);
  });

  it('ignores a film that is already there', () => {
    const before = route(1, 2);
    expect(withStepAdded(before, result(2))).toBe(before);
  });

  it('ignores a film when there are already ten', () => {
    const before = route(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    expect(withStepAdded(before, result(11))).toBe(before);
  });
});

describe('withStepRemoved', () => {
  it('closes the gap in the numbering', () => {
    const next = withStepRemoved(route(1, 2, 3), 'step-2');
    expect(ids(next)).toEqual(['step-1', 'step-3']);
    expect(next.steps.map((s) => s.position)).toEqual([1, 2]);
  });
});

describe('withStepsOrdered', () => {
  it('follows the list it is given and renumbers', () => {
    const next = withStepsOrdered(route(1, 2, 3), [
      'step-3',
      'step-1',
      'step-2',
    ]);
    expect(ids(next)).toEqual(['step-3', 'step-1', 'step-2']);
    expect(next.steps.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it('keeps the old order when the list is not the same films', () => {
    const before = route(1, 2, 3);
    expect(withStepsOrdered(before, ['step-1', 'step-2'])).toBe(before);
    expect(withStepsOrdered(before, ['step-1', 'step-2', 'step-9'])).toBe(
      before,
    );
    expect(withStepsOrdered(before, ['step-1', 'step-1', 'step-2'])).toBe(
      before,
    );
  });
});

describe('moveItem', () => {
  it('moves an item up and down', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('does nothing past either end', () => {
    const list = ['a', 'b', 'c'];
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 2, 3)).toBe(list);
    expect(moveItem(list, 5, 0)).toBe(list);
  });
});

describe('isLockedRefusal', () => {
  it('knows the refusal of a route that has travelers', () => {
    expect(isLockedRefusal({ status: 409, code: 'route_locked' })).toBe(true);
    expect(isLockedRefusal({ status: 423, code: 'whatever' })).toBe(true);
  });

  it('does not mistake the other 409s for it', () => {
    expect(isLockedRefusal({ status: 409, code: 'route_full' })).toBe(false);
    expect(
      isLockedRefusal({ status: 409, code: 'film_already_in_route' }),
    ).toBe(false);
    expect(isLockedRefusal(new Error('x'))).toBe(false);
    expect(isLockedRefusal(null)).toBe(false);
  });
});
