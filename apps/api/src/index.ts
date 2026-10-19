import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPrismaClient } from './db.js';

const config = loadConfig();
const db = createPrismaClient(config.DATABASE_URL);
const app = createApp({ corsOrigins: config.CORS_ORIGINS });

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
