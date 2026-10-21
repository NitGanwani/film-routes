import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, createTestDb, resetDb } from '../test/helpers.js';
import { hashRefreshToken } from './tokens.js';

// Integration tests: they need the Postgres test database (see README).
const db = createTestDb();
const app = createTestApp(db);

const credentials = {
  username: 'Ada_Lovelace',
  email: 'Ada@Example.com',
  password: 'correct horse battery staple',
};

const register = (body: object = credentials) =>
  request(app).post('/auth/register').send(body);

beforeEach(() => resetDb(db));
afterAll(async () => {
  await resetDb(db);
  await db.$disconnect();
});

describe('POST /auth/register', () => {
  it('creates the user and returns tokens, never the password hash', async () => {
    const response = await register();

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      username: 'ada_lovelace',
      email: 'ada@example.com',
      locale: 'es',
    });
    expect(response.body.tokens.tokenType).toBe('Bearer');
    expect(response.body.tokens.expiresIn).toBe(900);
    expect(JSON.stringify(response.body)).not.toMatch(/argon2|passwordHash/i);
  });

  it('stores an argon2id hash and only the hash of the refresh token', async () => {
    const response = await register();
    const { refreshToken } = response.body.tokens;

    const user = await db.user.findUniqueOrThrow({
      where: { email: 'ada@example.com' },
    });
    const stored = await db.refreshToken.findMany();

    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).toBe(hashRefreshToken(refreshToken));
    expect(stored[0]?.tokenHash).not.toBe(refreshToken);
  });

  it('rejects a duplicate username or email with the same generic 409', async () => {
    await register();

    const sameEmail = await register({
      ...credentials,
      username: 'someone_else',
    });
    const sameUsername = await register({
      ...credentials,
      email: 'other@example.com',
    });

    expect(sameEmail.status).toBe(409);
    expect(sameUsername.status).toBe(409);
    expect(sameEmail.body).toEqual(sameUsername.body);
    expect(sameEmail.body.error.code).toBe('account_conflict');
  });

  it('validates the body', async () => {
    const shortPassword = await register({ ...credentials, password: 'short' });
    const badEmail = await register({ ...credentials, email: 'nope' });
    const badUsername = await register({ ...credentials, username: 'a b' });
    const empty = await request(app).post('/auth/register');

    for (const response of [shortPassword, badEmail, badUsername, empty]) {
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('validation_error');
    }
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await register();
  });

  it('logs in with the right password, ignoring email case', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'ADA@example.com', password: credentials.password });

    expect(response.status).toBe(200);
    expect(response.body.tokens.accessToken).toEqual(expect.any(String));
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'wrong password!!' });
    const unknownEmail = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: credentials.password });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it('is rate limited per IP', async () => {
    const limited = createTestApp(db, { authAttemptsPer15Min: 2 });
    const attempt = () =>
      request(limited)
        .post('/auth/login')
        .send({ email: 'ada@example.com', password: 'wrong password!!' });

    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('too_many_requests');
  });
});

describe('GET /auth/me', () => {
  it('returns the user for a valid access token', async () => {
    const { body } = await register();

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${body.tokens.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('ada@example.com');
  });

  it('rejects missing, malformed and wrongly signed tokens', async () => {
    const responses = await Promise.all([
      request(app).get('/auth/me'),
      request(app).get('/auth/me').set('Authorization', 'Bearer garbage'),
      request(app).get('/auth/me').set('Authorization', 'Basic abc'),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('unauthorized');
    }
  });
});

describe('POST /auth/refresh', () => {
  it('rotates: the new token works and the old one is rejected', async () => {
    const { body } = await register();
    const first = body.tokens.refreshToken;

    const rotated = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: first });
    const second = rotated.body.tokens.refreshToken;

    expect(rotated.status).toBe(200);
    expect(second).not.toBe(first);

    const reused = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: first });
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe('invalid_refresh_token');
  });

  it('revokes the whole family when an old token is replayed', async () => {
    const { body } = await register();
    const first = body.tokens.refreshToken;
    const rotated = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: first });
    const second = rotated.body.tokens.refreshToken;

    // An attacker (or a buggy client) presents the already used token...
    await request(app).post('/auth/refresh').send({ refreshToken: first });

    // ...so even the legitimate newest token stops working.
    const afterReplay = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: second });
    expect(afterReplay.status).toBe(401);
  });

  it('rejects an expired refresh token', async () => {
    const { body } = await register();
    await db.refreshToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: body.tokens.refreshToken });

    expect(response.status).toBe(401);
  });

  it('rejects an unknown token', async () => {
    const response = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'never-issued' });

    expect(response.status).toBe(401);
  });

  it('lets only one of two concurrent requests win', async () => {
    const { body } = await register();
    const send = () =>
      request(app)
        .post('/auth/refresh')
        .send({ refreshToken: body.tokens.refreshToken });

    const statuses = (await Promise.all([send(), send()]))
      .map((response) => response.status)
      .sort();

    expect(statuses).toEqual([200, 401]);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token and is idempotent', async () => {
    const { body } = await register();
    const { refreshToken } = body.tokens;

    const first = await request(app)
      .post('/auth/logout')
      .send({ refreshToken });
    const second = await request(app)
      .post('/auth/logout')
      .send({ refreshToken });
    const afterLogout = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(afterLogout.status).toBe(401);
  });
});
