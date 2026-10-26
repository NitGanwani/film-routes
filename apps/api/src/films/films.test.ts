import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../errors.js';
import {
  createFakeTmdb,
  createTestApp,
  createTestDb,
  matrix,
  resetDb,
} from '../test/helpers.js';
import {
  createFilmService,
  MAX_CACHE_AGE_DAYS,
  REFRESH_AFTER_DAYS,
} from './service.js';

// Integration tests: they need the Postgres test database (see README).
const db = createTestDb();
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => resetDb(db));
afterAll(async () => {
  await resetDb(db);
  await db.$disconnect();
});

async function signedInApp(overrides = {}) {
  const tmdb = createFakeTmdb();
  const app = createTestApp(db, { tmdb, ...overrides });
  const { body } = await request(app).post('/auth/register').send({
    username: 'ada',
    email: 'ada@example.com',
    password: 'correct horse battery staple',
  });
  const auth = { Authorization: `Bearer ${body.tokens.accessToken}` };
  return { app, tmdb, auth };
}

describe('GET /films/search', () => {
  it('requires a signed-in user', async () => {
    const { app, tmdb } = await signedInApp();

    const response = await request(app).get('/films/search?q=matrix');

    expect(response.status).toBe(401);
    expect(tmdb.searchMovies).not.toHaveBeenCalled();
  });

  it('returns results with a full poster URL and stores nothing', async () => {
    const { app, auth } = await signedInApp();

    const response = await request(app)
      .get('/films/search?q=matrix&locale=es')
      .set(auth);

    expect(response.status).toBe(200);
    expect(response.body.results[0]).toMatchObject({
      tmdbId: 603,
      title: 'Matrix',
      posterUrl: 'https://image.tmdb.org/t/p/w500/matrix.jpg',
    });
    expect(await db.film.count()).toBe(0);
  });

  it('passes the locale and page to TMDB', async () => {
    const { app, tmdb, auth } = await signedInApp();

    await request(app).get('/films/search?q=matrix&locale=en&page=2').set(auth);

    expect(tmdb.searchMovies).toHaveBeenCalledWith('matrix', 'en', 2);
  });

  it('validates the query', async () => {
    const { app, tmdb, auth } = await signedInApp();
    const bad = [
      '/films/search',
      '/films/search?q=',
      '/films/search?q=matrix&page=0',
      '/films/search?q=matrix&page=501',
      '/films/search?q=matrix&locale=fr',
    ];

    for (const url of bad) {
      const response = await request(app).get(url).set(auth);
      expect(response.status, url).toBe(400);
      expect(response.body.error.code).toBe('validation_error');
    }
    expect(tmdb.searchMovies).not.toHaveBeenCalled();
  });

  it('is rate limited', async () => {
    const { app, auth } = await signedInApp({ filmRequestsPerMinute: 2 });
    const search = () => request(app).get('/films/search?q=matrix').set(auth);

    expect((await search()).status).toBe(200);
    expect((await search()).status).toBe(200);
    expect((await search()).status).toBe(429);
  });
});

describe('GET /films/:tmdbId', () => {
  it('requires a signed-in user', async () => {
    const { app } = await signedInApp();

    expect((await request(app).get('/films/603')).status).toBe(401);
  });

  it('fetches an unknown film from TMDB without storing it', async () => {
    const { app, tmdb, auth } = await signedInApp();

    const response = await request(app).get('/films/603?locale=en').set(auth);

    expect(response.status).toBe(200);
    expect(response.body.film).toMatchObject({
      title: 'The Matrix',
      runtimeMinutes: 136,
    });
    expect(tmdb.getMovie).toHaveBeenCalledWith(603, 'en');
    expect(await db.film.count()).toBe(0);
  });

  it('maps an unknown film to 404 and a bad id to 400', async () => {
    const { app, auth } = await signedInApp();

    const missing = await request(app).get('/films/999').set(auth);
    const invalid = await request(app).get('/films/abc').set(auth);

    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('film_not_found');
    expect(invalid.status).toBe(400);
  });

  it('serves a stored film in the requested language without calling TMDB', async () => {
    const { app, tmdb, auth } = await signedInApp();
    await createFilmService(db, tmdb).ensureFilm(603);
    tmdb.getMovie.mockClear();

    const es = await request(app).get('/films/603?locale=es').set(auth);
    const en = await request(app).get('/films/603?locale=en').set(auth);

    expect(es.body.film.title).toBe('Matrix');
    expect(en.body.film.title).toBe('The Matrix');
    expect(tmdb.getMovie).not.toHaveBeenCalled();
  });
});

describe('ensureFilm (storing a chosen film)', () => {
  it('stores the film with both translations', async () => {
    const tmdb = createFakeTmdb();

    const film = await createFilmService(db, tmdb).ensureFilm(603);

    expect(film).toMatchObject({
      tmdbId: 603,
      originalTitle: 'The Matrix',
      releaseYear: 1999,
      runtimeMinutes: 136,
      imdbId: 'tt0133093',
    });
    expect(film.translations.map((t) => [t.locale, t.title]).sort()).toEqual([
      ['EN', 'The Matrix'],
      ['ES', 'Matrix'],
    ]);
  });

  it('does not call TMDB again while the copy is fresh', async () => {
    const tmdb = createFakeTmdb();
    let current = new Date('2026-01-01T00:00:00Z');
    const service = createFilmService(db, tmdb, () => current);

    await service.ensureFilm(603);
    tmdb.getMovie.mockClear();
    current = new Date(current.getTime() + (REFRESH_AFTER_DAYS - 1) * DAY_MS);
    await service.ensureFilm(603);

    expect(tmdb.getMovie).not.toHaveBeenCalled();
  });

  it('refreshes a stale copy without creating duplicates', async () => {
    const tmdb = createFakeTmdb();
    let current = new Date('2026-01-01T00:00:00Z');
    const service = createFilmService(db, tmdb, () => current);
    await service.ensureFilm(603);

    tmdb.getMovie.mockImplementation(async (_id, locale) => ({
      ...matrix(locale),
      title:
        locale === 'es' ? 'Matrix (remasterizada)' : 'The Matrix (remastered)',
    }));
    current = new Date(current.getTime() + (REFRESH_AFTER_DAYS + 1) * DAY_MS);
    const refreshed = await service.ensureFilm(603);

    expect(await db.film.count()).toBe(1);
    expect(await db.filmTranslation.count()).toBe(2);
    expect(refreshed.translations.map((t) => t.title).sort()).toEqual([
      'Matrix (remasterizada)',
      'The Matrix (remastered)',
    ]);
    expect(refreshed.updatedAt).toEqual(current);
  });

  it('serves the stale copy if TMDB is down, until the 6-month cap', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tmdb = createFakeTmdb();
    let current = new Date('2026-01-01T00:00:00Z');
    const service = createFilmService(db, tmdb, () => current);
    await service.ensureFilm(603);
    tmdb.getMovie.mockRejectedValue(
      new HttpError(502, 'tmdb_unavailable', 'down'),
    );

    current = new Date(current.getTime() + (REFRESH_AFTER_DAYS + 1) * DAY_MS);
    expect((await service.ensureFilm(603)).tmdbId).toBe(603);

    current = new Date(current.getTime() + MAX_CACHE_AGE_DAYS * DAY_MS);
    await expect(service.ensureFilm(603)).rejects.toMatchObject({
      status: 502,
    });
    quiet.mockRestore();
  });

  it('stays at one film when two requests store it at the same time', async () => {
    const tmdb = createFakeTmdb();
    const service = createFilmService(db, tmdb);

    await Promise.all([service.ensureFilm(603), service.ensureFilm(603)]);

    expect(await db.film.count()).toBe(1);
  });
});
