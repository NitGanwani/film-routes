import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../errors.js';
import { createTmdbClient } from './client.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const movie = {
  id: 603,
  title: 'Matrix',
  original_title: 'The Matrix',
  overview: 'Un hacker descubre la verdad.',
  release_date: '1999-03-31',
  poster_path: '/poster.jpg',
};

function clientWith(fetchImpl: typeof fetch) {
  return createTmdbClient({ accessToken: 'secret-token', fetchImpl });
}

describe('tmdb client', () => {
  it('sends the bearer token and maps the locale to a TMDB language', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json({ page: 1, total_pages: 1, results: [] }),
    );

    await clientWith(fetchImpl).searchMovies('matrix', 'es');

    const [url, init] = fetchImpl.mock.calls[0]!;
    const requested = new URL(String(url));
    expect(requested.pathname).toBe('/3/search/movie');
    expect(requested.searchParams.get('language')).toBe('es-ES');
    expect(requested.searchParams.get('query')).toBe('matrix');
    expect(requested.searchParams.get('include_adult')).toBe('false');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer secret-token',
    );
  });

  it('normalises search results', async () => {
    const client = clientWith(async () =>
      json({
        page: 1,
        total_pages: 3,
        results: [
          movie,
          // TMDB sends "" for unknown dates and missing overviews.
          {
            ...movie,
            id: 1,
            overview: '',
            release_date: '',
            poster_path: null,
          },
        ],
      }),
    );

    const page = await client.searchMovies('matrix', 'en');

    expect(page.totalPages).toBe(3);
    expect(page.results[0]).toEqual({
      tmdbId: 603,
      title: 'Matrix',
      originalTitle: 'The Matrix',
      overview: 'Un hacker descubre la verdad.',
      releaseYear: 1999,
      posterPath: '/poster.jpg',
    });
    expect(page.results[1]).toMatchObject({
      overview: null,
      releaseYear: null,
      posterPath: null,
    });
  });

  it('returns runtime and IMDb id for a film', async () => {
    const client = clientWith(async () =>
      json({ ...movie, runtime: 136, imdb_id: 'tt0133093' }),
    );

    const detail = await client.getMovie(603, 'en');

    expect(detail).toMatchObject({
      tmdbId: 603,
      runtimeMinutes: 136,
      imdbId: 'tt0133093',
    });
  });

  it('turns a missing runtime (0) into null', async () => {
    const client = clientWith(async () =>
      json({ ...movie, runtime: 0, imdb_id: '' }),
    );

    expect(await client.getMovie(603, 'en')).toMatchObject({
      runtimeMinutes: null,
      imdbId: null,
    });
  });

  it('maps a TMDB 404 to film_not_found', async () => {
    const client = clientWith(async () => json({}, 404));

    await expect(client.getMovie(1, 'en')).rejects.toMatchObject({
      status: 404,
      code: 'film_not_found',
    });
  });

  it('maps network failures, TMDB errors and bad payloads to a 502', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failures: Array<typeof fetch> = [
      async () => {
        throw new TypeError('network down');
      },
      async () => json({}, 500),
      async () => json({ unexpected: true }),
      async () => new Response('<html>not json</html>'),
    ];

    for (const failing of failures) {
      const error = await clientWith(failing)
        .searchMovies('matrix', 'en')
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ status: 502, code: 'tmdb_unavailable' });
    }
    quiet.mockRestore();
  });

  it('never leaks the token in an error', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = await clientWith(async () => json({}, 500))
      .searchMovies('matrix', 'en')
      .catch((caught: unknown) => caught as Error);

    expect(JSON.stringify(error)).not.toContain('secret-token');
    expect((error as Error).message).not.toContain('secret-token');
    quiet.mockRestore();
  });
});
