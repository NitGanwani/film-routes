import type { Locale } from '@film-routes/shared';
import { z } from 'zod';
import { HttpError } from '../errors.js';

const BASE_URL = 'https://api.themoviedb.org/3';

const TMDB_LANGUAGE: Record<Locale, string> = { es: 'es-ES', en: 'en-US' };

// Only the fields we use. TMDB sends many more; anything unexpected is ignored.
const movieSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  original_title: z.string(),
  overview: z.string().nullish(),
  release_date: z.string().nullish(),
  poster_path: z.string().nullable(),
});

const searchSchema = z.object({
  page: z.number().int(),
  total_pages: z.number().int(),
  results: z.array(movieSchema),
});

const detailSchema = movieSchema.extend({
  runtime: z.number().int().nullish(),
  imdb_id: z.string().nullish(),
});

export type TmdbMovie = {
  tmdbId: number;
  title: string;
  originalTitle: string;
  overview: string | null;
  releaseYear: number | null;
  posterPath: string | null;
};

export type TmdbMovieDetail = TmdbMovie & {
  runtimeMinutes: number | null;
  imdbId: string | null;
};

export type TmdbSearchPage = {
  page: number;
  totalPages: number;
  results: TmdbMovie[];
};

type RawMovie = z.infer<typeof movieSchema>;

function toMovie(raw: RawMovie): TmdbMovie {
  // TMDB uses "" (not null) for unknown dates and missing overviews.
  const year = Number.parseInt((raw.release_date ?? '').slice(0, 4), 10);
  return {
    tmdbId: raw.id,
    title: raw.title,
    originalTitle: raw.original_title,
    overview: raw.overview || null,
    releaseYear: Number.isNaN(year) ? null : year,
    posterPath: raw.poster_path,
  };
}

type ClientOptions = {
  accessToken: string;
  /** Injectable so tests never hit the network. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const unavailable = () =>
  new HttpError(502, 'tmdb_unavailable', 'Film catalogue is unavailable');

export function createTmdbClient({
  accessToken,
  fetchImpl = fetch,
  timeoutMs = 5000,
}: ClientOptions) {
  async function get<T extends z.ZodType>(
    path: string,
    params: Record<string, string>,
    schema: T,
  ): Promise<z.output<T>> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw unavailable();
    }

    if (response.status === 404) {
      throw new HttpError(404, 'film_not_found', 'Film not found');
    }
    if (!response.ok) {
      console.error(`TMDB answered ${response.status} for ${path}`);
      throw unavailable();
    }

    const parsed = schema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      // TMDB changed its response shape: log the cause, hide it from clients.
      console.error(`Unexpected TMDB payload for ${path}`, parsed.error.issues);
      throw unavailable();
    }
    return parsed.data;
  }

  return {
    async searchMovies(
      query: string,
      locale: Locale,
      page = 1,
    ): Promise<TmdbSearchPage> {
      const data = await get(
        '/search/movie',
        {
          query,
          language: TMDB_LANGUAGE[locale],
          page: String(page),
          include_adult: 'false',
        },
        searchSchema,
      );
      return {
        page: data.page,
        totalPages: data.total_pages,
        results: data.results.map(toMovie),
      };
    },

    async getMovie(tmdbId: number, locale: Locale): Promise<TmdbMovieDetail> {
      const data = await get(
        `/movie/${tmdbId}`,
        { language: TMDB_LANGUAGE[locale] },
        detailSchema,
      );
      return {
        ...toMovie(data),
        runtimeMinutes: data.runtime || null,
        imdbId: data.imdb_id || null,
      };
    },
  };
}

export type TmdbClient = ReturnType<typeof createTmdbClient>;
