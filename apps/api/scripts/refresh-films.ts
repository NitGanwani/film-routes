/**
 * Fills in the backdrop of films saved before backdrops existed: it goes over
 * the stored films that have none and refreshes each one from TMDB.
 *
 *   npm run films:refresh -w @film-routes/api
 *
 * A refresh also renews the film's cache date, so this stays within TMDB's
 * rule of never keeping its data longer than 6 months. Safe to run again; a
 * film that TMDB really has no backdrop for is simply asked about again.
 */
import { loadConfig } from '../src/config.js';
import { createPrismaClient } from '../src/db.js';
import { createFilmService } from '../src/films/service.js';
import { createTmdbClient } from '../src/tmdb/client.js';

const config = loadConfig();
const db = createPrismaClient(config.DATABASE_URL);
const films = createFilmService(
  db,
  createTmdbClient({ accessToken: config.TMDB_ACCESS_TOKEN }),
);

try {
  const pending = await db.film.findMany({
    where: { backdropPath: null },
    select: { tmdbId: true, originalTitle: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`${pending.length} film(s) without a backdrop`);

  let found = 0;
  let none = 0;
  let failed = 0;
  for (const { tmdbId, originalTitle } of pending) {
    const before = await db.film.findUniqueOrThrow({
      where: { tmdbId },
      select: { updatedAt: true },
    });
    // `force`: refresh even though the stored copy is not old yet.
    const film = await films.ensureFilm(tmdbId, { force: true });
    if (film.updatedAt.getTime() === before.updatedAt.getTime()) {
      // ensureFilm keeps serving the stored copy when TMDB cannot be reached.
      failed += 1;
      console.log(`  could not refresh ${originalTitle} (${tmdbId})`);
    } else if (film.backdropPath) {
      found += 1;
      console.log(`  backdrop added: ${originalTitle} (${tmdbId})`);
    } else {
      none += 1;
      console.log(`  TMDB has no backdrop: ${originalTitle} (${tmdbId})`);
    }
  }
  console.log(
    `Done: ${found} with a new backdrop, ${none} without one on TMDB, ${failed} not refreshed`,
  );
  process.exitCode = failed > 0 ? 1 : 0;
} finally {
  await db.$disconnect();
}
