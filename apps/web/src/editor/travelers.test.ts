import { describe, expect, it } from 'vitest';
import type { Film, Traveler, TravelerStep } from '../api/types.js';
import {
  journeyFrames,
  matchSummary,
  sortTravelers,
  travelersSummary,
  visibleTravelers,
} from './travelers.js';

const traveler = (change: Partial<Traveler>): Traveler => ({
  id: 'e',
  username: 'ana',
  status: 'active',
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: null,
  closedSteps: 0,
  stepCount: 4,
  ...change,
});

const film = {
  tmdbId: 1,
  posterUrl: 'big.jpg',
  posterUrlSmall: 'small.jpg',
} as Film;

const step = (change: Partial<TravelerStep>): TravelerStep => ({
  id: 's',
  position: 1,
  film,
  state: 'closed',
  authorEmotions: ['joy'],
  travelerEmotions: ['joy'],
  travelerComment: null,
  seenBefore: false,
  watchedAt: null,
  sharedEmotions: ['joy'],
  ...change,
});

describe('visibleTravelers', () => {
  it('drops the ones the author removed', () => {
    const list = [
      traveler({ id: 'a' }),
      traveler({ id: 'b', status: 'removed' }),
      traveler({ id: 'c', status: 'abandoned' }),
    ];
    expect(visibleTravelers(list).map((item) => item.id)).toEqual(['a', 'c']);
  });
});

describe('sortTravelers', () => {
  it('puts the ones on their way first, then finished, then gone', () => {
    const sorted = sortTravelers([
      traveler({ id: 'gone', status: 'abandoned' }),
      traveler({ id: 'done', status: 'completed' }),
      traveler({ id: 'going', status: 'active' }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['going', 'done', 'gone']);
  });

  it('puts the latest to join first inside a group, without touching the original', () => {
    const list = [
      traveler({ id: 'old', startedAt: '2026-10-01T10:00:00.000Z' }),
      traveler({ id: 'new', startedAt: '2026-11-10T10:00:00.000Z' }),
    ];
    expect(sortTravelers(list).map((item) => item.id)).toEqual(['new', 'old']);
    expect(list[0]?.id).toBe('old');
  });
});

describe('travelersSummary', () => {
  it('counts everyone and those who finished', () => {
    expect(
      travelersSummary([
        traveler({ status: 'active' }),
        traveler({ status: 'completed' }),
        traveler({ status: 'completed' }),
      ]),
    ).toEqual({ total: 3, completed: 2 });
    expect(travelersSummary([])).toEqual({ total: 0, completed: 0 });
  });
});

describe('matchSummary', () => {
  it('counts the films they felt the same about, out of the comparable ones', () => {
    expect(
      matchSummary([
        step({ sharedEmotions: ['joy'] }),
        step({ sharedEmotions: [] }),
        step({ sharedEmotions: ['joy'] }),
      ]),
    ).toEqual({ same: 2, total: 3 });
  });

  it('leaves out films that cannot be compared', () => {
    expect(
      matchSummary([
        step({ sharedEmotions: ['joy'] }),
        step({ sharedEmotions: null, authorEmotions: [] }),
        step({ state: 'pending', sharedEmotions: null, travelerEmotions: [] }),
      ]),
    ).toEqual({ same: 1, total: 1 });
  });

  it('is null when there is nothing to compare', () => {
    expect(matchSummary([])).toBeNull();
    expect(matchSummary([step({ sharedEmotions: null })])).toBeNull();
  });
});

describe('journeyFrames', () => {
  it('has one frame per film with its small poster and its state', () => {
    expect(
      journeyFrames([step({ state: 'closed' }), step({ state: 'pending' })]),
    ).toEqual([
      { posterUrl: 'small.jpg', state: 'closed' },
      { posterUrl: 'small.jpg', state: 'pending' },
    ]);
  });
});
