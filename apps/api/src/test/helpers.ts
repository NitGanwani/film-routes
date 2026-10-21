import { createApp, type AppOptions } from '../app.js';
import type { AuthSettings } from '../auth/service.js';
import { createPrismaClient } from '../db.js';

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

export function createTestApp(db: TestDb, overrides: Partial<AppOptions> = {}) {
  return createApp({
    corsOrigins: ['http://localhost:5173'],
    db,
    auth: testAuthSettings,
    // High enough that unrelated tests never trip the limiter.
    authAttemptsPer15Min: 1000,
    ...overrides,
  });
}
