import { describe, expect, it } from 'vitest';
import type { PublicRouteSummary } from '../api/types.js';
import {
  exampleRoute,
  featuredRoutes,
  mosaicRows,
  MOSAIC_TILES,
  stripPosters,
  STRIP_MIN_POSTERS,
} from './model.js';

const route = (id: string, locale: 'es' | 'en'): PublicRouteSummary => ({
  id,
  title: id,
  description: null,
  locale,
  author: 'a',
  stepCount: 3,
  completions: 0,
  rating: { average: null, votes: 0 },
  posters: [],
  coverUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
});

describe('mosaicRows', () => {
  it('fills two rows of four, repeating pictures when there are few', () => {
    const [a, b] = mosaicRows(['x', 'y', 'z']);
    expect(a).toHaveLength(MOSAIC_TILES / 2);
    expect(b).toHaveLength(MOSAIC_TILES / 2);
    expect(new Set([...a, ...b])).toEqual(new Set(['x', 'y', 'z']));
  });

  it('ignores missing and repeated covers', () => {
    const [a, b] = mosaicRows([null, 'x', 'x', null]);
    expect(new Set([...a, ...b])).toEqual(new Set(['x']));
  });

  it('has no mosaic without covers', () => {
    expect(mosaicRows([null])).toEqual([[], []]);
    expect(mosaicRows([])).toEqual([[], []]);
  });
});

describe('stripPosters', () => {
  it('drops films without a poster and repeats up to a width worth sliding', () => {
    const strip = stripPosters(['a', null, 'b', 'c']);
    expect(strip).toHaveLength(STRIP_MIN_POSTERS);
    expect(strip.slice(0, 3)).toEqual(['a', 'b', 'c']);
  });

  it('keeps a long route whole', () => {
    const posters = Array.from({ length: 12 }, (_, i) => `p${i}`);
    expect(stripPosters(posters)).toEqual(posters);
  });

  it('is empty when no film has a poster', () => {
    expect(stripPosters([null, null])).toEqual([]);
  });
});

describe('exampleRoute and featuredRoutes', () => {
  const routes = [route('1', 'en'), route('2', 'es'), route('3', 'es')];

  it('prefer the reader language, in the order given', () => {
    expect(exampleRoute(routes, 'es')?.id).toBe('2');
    expect(featuredRoutes(routes, 'es').map((r) => r.id)).toEqual(['2', '3']);
  });

  it('fall back to what exists', () => {
    expect(exampleRoute(routes.slice(0, 1), 'es')?.id).toBe('1');
    expect(featuredRoutes(routes.slice(0, 1), 'es').map((r) => r.id)).toEqual([
      '1',
    ]);
    expect(exampleRoute([], 'es')).toBeNull();
    expect(featuredRoutes([], 'es')).toEqual([]);
  });

  it('show at most three cards', () => {
    const many = ['1', '2', '3', '4'].map((id) => route(id, 'es'));
    expect(featuredRoutes(many, 'es')).toHaveLength(3);
  });
});
