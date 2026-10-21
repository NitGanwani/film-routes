import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const validEnv = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('applies defaults and splits the CORS origins', () => {
    const config = loadConfig({
      ...validEnv,
      CORS_ORIGINS: 'http://a.test, http://b.test',
    });

    expect(config.PORT).toBe(3000);
    expect(config.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(config.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(config.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('fails with a readable message when DATABASE_URL is missing', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a JWT secret that is too short', () => {
    expect(() =>
      loadConfig({ ...validEnv, JWT_ACCESS_SECRET: 'short' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });
});
