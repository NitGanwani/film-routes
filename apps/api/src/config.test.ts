import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applies defaults and splits the CORS origins', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      CORS_ORIGINS: 'http://a.test, http://b.test',
    });

    expect(config.PORT).toBe(3000);
    expect(config.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('fails with a readable message when DATABASE_URL is missing', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});
