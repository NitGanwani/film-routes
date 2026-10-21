import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp, createTestDb } from './test/helpers.js';

// Prisma connects lazily, so these tests never touch the database.
const app = createTestApp(createTestDb());

describe('app', () => {
  it('answers the health check', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const response = await request(app).get('/nope');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('not_found');
  });

  it('sets security headers', async () => {
    const response = await request(app).get('/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('only allows configured CORS origins', async () => {
    const allowed = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');
    const denied = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example');

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
