import type { Locale } from '@film-routes/shared';
import { vi } from 'vitest';
import { createApp, type AppOptions } from '../app.js';
import type { AuthSettings } from '../auth/service.js';
import { createPrismaClient } from '../db.js';
import { HttpError } from '../errors.js';
import type { TmdbClient, TmdbMovieDetail } from '../tmdb/client.js';

export const testAuthSettings: AuthSettings = {
  accessSecret: 'test-secret-test-secret-test-secret-0123',
  accessTtlSeconds: 900,
  refreshTtlDays: 30,
};

const DEFAULT_TEST_DATABASE_URL =
  'postgresql://film_routes:film_routes@localhost:5432/film_routes_test';

/**
 * Prisma client for the dedicated test database. It refuses any database whose
 * name does not end in `_test`, so a wrong URL can never wipe development data.
 */
export function createTestDb() {
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error(
      'TEST_DATABASE_URL must point to a database ending in _test',
    );
  }
  return createPrismaClient(url);
}

export type TestDb = ReturnType<typeof createTestDb>;

/** Empties every table (users cascades to everything that references them). */
export async function resetDb(db: TestDb) {
  await db.$executeRaw`TRUNCATE TABLE users, films CASCADE`;
}

export const matrix = (locale: Locale): TmdbMovieDetail => ({
  tmdbId: 603,
  title: locale === 'es' ? 'Matrix' : 'The Matrix',
  originalTitle: 'The Matrix',
  overview:
    locale === 'es'
      ? 'Un hacker descubre la verdad.'
      : 'A hacker learns the truth.',
  releaseYear: 1999,
  posterPath: '/matrix.jpg',
  runtimeMinutes: 136,
  imdbId: 'tt0133093',
});

/** Filler films 1..50, enough to fill a route (the limit is 12 steps). */
const filler = (tmdbId: number, locale: Locale): TmdbMovieDetail => ({
  tmdbId,
  title: locale === 'es' ? `Película ${tmdbId}` : `Film ${tmdbId}`,
  originalTitle: `Film ${tmdbId}`,
  overview: null,
  releaseYear: 2000,
  posterPath: null,
  runtimeMinutes: 90,
  imdbId: null,
});

/** A TMDB stand-in that knows film 603 and fillers 1..50; calls are recorded. */
export function createFakeTmdb() {
  return {
    searchMovies: vi.fn<TmdbClient['searchMovies']>(async (_query, locale) => ({
      page: 1,
      totalPages: 1,
      results: [matrix(locale)],
    })),
    getMovie: vi.fn<TmdbClient['getMovie']>(async (tmdbId, locale) => {
      if (tmdbId === 603) {
        return matrix(locale);
      }
      if (tmdbId >= 1 && tmdbId <= 50) {
        return filler(tmdbId, locale);
      }
      throw new HttpError(404, 'film_not_found', 'Film not found');
    }),
  };
}

export function createTestApp(db: TestDb, overrides: Partial<AppOptions> = {}) {
  return createApp({
    corsOrigins: ['http://localhost:5173'],
    db,
    auth: testAuthSettings,
    tmdb: createFakeTmdb(),
    // High enough that unrelated tests never trip the limiters.
    authAttemptsPer15Min: 1000,
    filmRequestsPerMinute: 1000,
    ...overrides,
  });
}
