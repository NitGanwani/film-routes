import type { Locale } from '@film-routes/shared';
import type { Db } from '../db.js';
import type { TmdbClient, TmdbMovie, TmdbMovieDetail } from '../tmdb/client.js';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const DAY_MS = 24 * 60 * 60 * 1000;

// TMDB's terms forbid caching its data for more than 6 months. We refresh well
// before that, and only serve older data (when TMDB is down) up to the hard cap.
export const REFRESH_AFTER_DAYS = 30;
export const MAX_CACHE_AGE_DAYS = 180;

export type FilmSummary = {
  tmdbId: number;
  title: string;
  originalTitle: string;
  overview: string | null;
  releaseYear: number | null;
  posterUrl: string | null;
};

export type FilmDetail = FilmSummary & { runtimeMinutes: number | null };

export type FilmSearchPage = {
  page: number;
  totalPages: number;
  results: FilmSummary[];
};

const posterUrl = (path: string | null) =>
  path ? `${IMAGE_BASE_URL}${path}` : null;

const toSummary = (movie: TmdbMovie): FilmSummary => ({
  tmdbId: movie.tmdbId,
  title: movie.title,
  originalTitle: movie.originalTitle,
  overview: movie.overview,
  releaseYear: movie.releaseYear,
  posterUrl: posterUrl(movie.posterPath),
});

const toDetail = (movie: TmdbMovieDetail): FilmDetail => ({
  ...toSummary(movie),
  runtimeMinutes: movie.runtimeMinutes,
});

const dbLocale = (locale: Locale) => (locale === 'es' ? 'ES' : 'EN');

export function createFilmService(
  db: Db,
  tmdb: TmdbClient,
  now: () => Date = () => new Date(),
) {
  const findCached = (tmdbId: number) =>
    db.film.findUnique({ where: { tmdbId }, include: { translations: true } });

  type CachedFilm = NonNullable<Awaited<ReturnType<typeof findCached>>>;

  const ageInDays = (film: CachedFilm) =>
    (now().getTime() - film.updatedAt.getTime()) / DAY_MS;

  const hasBothLocales = (film: CachedFilm) => film.translations.length === 2;

  function fromCache(film: CachedFilm, locale: Locale): FilmDetail | null {
    const translation = film.translations.find(
      (item) => item.locale === dbLocale(locale),
    );
    if (!translation) {
      return null;
    }
    return {
      tmdbId: film.tmdbId,
      title: translation.title,
      originalTitle: film.originalTitle,
      overview: translation.overview,
      releaseYear: film.releaseYear,
      posterUrl: posterUrl(film.posterPath),
      runtimeMinutes: film.runtimeMinutes,
    };
  }

  /**
   * Makes sure a film is stored (with both translations) and not stale, then
   * returns it. This is what "adding a film to a route" will call: only chosen
   * films ever reach our database.
   */
  async function ensureFilm(tmdbId: number): Promise<CachedFilm> {
    const cached = await findCached(tmdbId);
    if (
      cached &&
      hasBothLocales(cached) &&
      ageInDays(cached) < REFRESH_AFTER_DAYS
    ) {
      return cached;
    }

    try {
      const [es, en] = await Promise.all([
        tmdb.getMovie(tmdbId, 'es'),
        tmdb.getMovie(tmdbId, 'en'),
      ]);
      const fetchedAt = now();

      return await db.$transaction(async (tx) => {
        // Film-level fields come from the English entry (TMDB's poster
        // depends on the language requested; we keep a single one).
        const fields = {
          imdbId: en.imdbId,
          originalTitle: en.originalTitle,
          releaseYear: en.releaseYear,
          runtimeMinutes: en.runtimeMinutes,
          posterPath: en.posterPath,
          updatedAt: fetchedAt,
        };
        const film = await tx.film.upsert({
          where: { tmdbId },
          create: { tmdbId, ...fields },
          update: fields,
        });

        for (const [locale, movie] of [
          ['es', es],
          ['en', en],
        ] as const) {
          const text = { title: movie.title, overview: movie.overview };
          await tx.filmTranslation.upsert({
            where: {
              filmId_locale: { filmId: film.id, locale: dbLocale(locale) },
            },
            create: { filmId: film.id, locale: dbLocale(locale), ...text },
            update: text,
          });
        }

        return tx.film.findUniqueOrThrow({
          where: { id: film.id },
          include: { translations: true },
        });
      });
    } catch (error) {
      // TMDB is down or changed: keep serving what we have while it is still
      // within the allowed cache window.
      if (
        cached &&
        hasBothLocales(cached) &&
        ageInDays(cached) < MAX_CACHE_AGE_DAYS
      ) {
        console.error(`Could not refresh film ${tmdbId}, serving cached copy`);
        return cached;
      }
      throw error;
    }
  }

  return {
    ensureFilm,

    async searchFilms(
      query: string,
      locale: Locale,
      page: number,
    ): Promise<FilmSearchPage> {
      const result = await tmdb.searchMovies(query, locale, page);
      return {
        page: result.page,
        totalPages: result.totalPages,
        results: result.results.map(toSummary),
      };
    },

    /** Reads a film; only films already chosen by someone are stored. */
    async getFilm(tmdbId: number, locale: Locale): Promise<FilmDetail> {
      if (await findCached(tmdbId)) {
        const film = await ensureFilm(tmdbId);
        const detail = fromCache(film, locale);
        if (detail) {
          return detail;
        }
      }
      return toDetail(await tmdb.getMovie(tmdbId, locale));
    },
  };
}

export type FilmService = ReturnType<typeof createFilmService>;
