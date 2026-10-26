import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPrismaClient } from './db.js';
import { createTmdbClient } from './tmdb/client.js';

const config = loadConfig();
const db = createPrismaClient(config.DATABASE_URL);
const app = createApp({
  corsOrigins: config.CORS_ORIGINS,
  db,
  tmdb: createTmdbClient({ accessToken: config.TMDB_ACCESS_TOKEN }),
  auth: {
    accessSecret: config.JWT_ACCESS_SECRET,
    accessTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
    refreshTtlDays: config.REFRESH_TOKEN_TTL_DAYS,
  },
});

const server = app.listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});

// Close the HTTP server and the database pool cleanly (Render, Docker, Ctrl+C).
async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
