import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestApp,
  createTestDb,
  makeAdmin,
  markVerified,
  resetDb,
} from '../test/helpers.js';

// Integration tests: they need the Postgres test database (see README).
const db = createTestDb();
const app = createTestApp(db);

beforeEach(() => resetDb(db));
afterAll(async () => {
  await resetDb(db);
  await db.$disconnect();
});

async function signUp(username: string, { verified = true } = {}) {
  const { body } = await request(app)
    .post('/auth/register')
    .send({
      username,
      email: `${username}@example.com`,
      password: 'correct horse battery staple',
    });
  if (verified) {
    await markVerified(db, body.user.id as string);
  }
  return {
    userId: body.user.id as string,
    auth: { Authorization: `Bearer ${body.tokens.accessToken}` },
  };
}

type Auth = Awaited<ReturnType<typeof signUp>>['auth'];

async function signUpAdmin(username = 'root') {
  const admin = await signUp(username);
  await makeAdmin(db, admin.userId);
  return admin;
}

/** A route of three films with notes, shared with the given visibility. */
async function sharedRoute(
  auth: Auth,
  visibility: 'public' | 'unlisted' = 'public',
  title = 'Horror for beginners',
) {
  const created = await request(app).post('/routes').set(auth).send({ title });
  const routeId = created.body.route.id as string;
  for (const tmdbId of [1, 2, 3]) {
    await request(app)
      .post(`/routes/${routeId}/steps`)
      .set(auth)
      .send({
        tmdbId,
        noteBefore: `secret before ${tmdbId}`,
        noteAfter: `secret after ${tmdbId}`,
      });
  }
  await request(app).patch(`/routes/${routeId}`).set(auth).send({ visibility });
  return routeId;
}

const report = (auth: Auth, routeId: string, body: object = {}) =>
  request(app)
    .post(`/routes/${routeId}/reports`)
    .set(auth)
    .send({ reason: 'spoiler', ...body });

describe('POST /routes/:id/reports', () => {
  it('records a report on a shared route', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);

    const response = await report(bob.auth, routeId, {
      reason: 'offensive',
      note: '  The note after step 2 is rude  ',
    });

    expect(response.status).toBe(201);
    expect(response.body.report).toMatchObject({
      reason: 'offensive',
      status: 'open',
    });
    const stored = await db.routeReport.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      routeId,
      reporterId: bob.userId,
      reason: 'OFFENSIVE',
      note: 'The note after step 2 is rude',
      status: 'OPEN',
      resolvedAt: null,
    });
  });

  it('works on an unlisted route too, and a blank note becomes nothing', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth, 'unlisted');

    const response = await report(bob.auth, routeId, { note: '   ' });

    expect(response.status).toBe(201);
    expect((await db.routeReport.findFirstOrThrow()).note).toBeNull();
  });

  it('requires a signed-in user', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);

    const response = await request(app)
      .post(`/routes/${routeId}/reports`)
      .send({ reason: 'spam' });

    expect(response.status).toBe(401);
  });

  it('requires a confirmed email', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob', { verified: false });
    const routeId = await sharedRoute(ada.auth);

    const response = await report(bob.auth, routeId);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('email_not_verified');
    expect(await db.routeReport.count()).toBe(0);
  });

  it('rejects an unknown reason, a missing reason and a very long note', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);

    const unknown = await report(bob.auth, routeId, { reason: 'boring' });
    const missing = await request(app)
      .post(`/routes/${routeId}/reports`)
      .set(bob.auth)
      .send({});
    const long = await report(bob.auth, routeId, { note: 'x'.repeat(501) });

    expect(unknown.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(long.status).toBe(400);
    expect(await db.routeReport.count()).toBe(0);
  });

  it('cannot be used on your own route', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);

    const response = await report(ada.auth, routeId);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('cannot_report_own_route');
  });

  it('looks like a missing route when it is private and you are not in it', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const created = await request(app)
      .post('/routes')
      .set(ada.auth)
      .send({ title: 'Secret draft' });

    const privateRoute = await report(bob.auth, created.body.route.id);
    const missing = await report(
      bob.auth,
      '019a0000-0000-7000-8000-000000000000',
    );

    expect(privateRoute.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(privateRoute.body).toEqual(missing.body);
  });

  it('lets a traveler report a route the author has made private again', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    await request(app).post(`/public/routes/${routeId}/join`).set(bob.auth);
    await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'private' });

    const response = await report(bob.auth, routeId);

    expect(response.status).toBe(201);
  });

  it('does not let a removed traveler report a private route', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const joined = await request(app)
      .post(`/public/routes/${routeId}/join`)
      .set(bob.auth);
    await request(app)
      .delete(`/routes/${routeId}/travelers/${joined.body.enrollment.id}`)
      .set(ada.auth);
    await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'private' });

    const response = await report(bob.auth, routeId);

    expect(response.status).toBe(404);
  });

  it('allows one report per person and route', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);

    const first = await report(bob.auth, routeId);
    const second = await report(bob.auth, routeId, { reason: 'spam' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('already_reported');
    expect(await db.routeReport.count()).toBe(1);
  });

  it('keeps one report when the same person sends two at once', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');

    for (let round = 0; round < 6; round += 1) {
      const routeId = await sharedRoute(ada.auth, 'public', `Route ${round}`);

      const [a, b] = await Promise.all([
        report(bob.auth, routeId),
        report(bob.auth, routeId),
      ]);

      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await db.routeReport.count({ where: { routeId } })).toBe(1);
    }
  });

  it('lets different people report the same route', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);

    for (const name of ['bob', 'carol', 'dave']) {
      const person = await signUp(name);
      expect((await report(person.auth, routeId)).status).toBe(201);
    }

    expect(await db.routeReport.count()).toBe(3);
  });

  it('does not report a route an admin already hid', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    await db.route.update({
      where: { id: routeId },
      data: { hiddenAt: new Date(), hiddenReason: 'because' },
    });

    const response = await report(bob.auth, routeId);

    expect(response.status).toBe(410);
    expect(response.body.error.code).toBe('route_hidden');
  });

  it('limits how many reports one account can file, not other accounts', async () => {
    const strict = createTestApp(db, { reportsPer15Min: 2 });
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const carol = await signUp('carol');
    const routes = [
      await sharedRoute(ada.auth, 'public', 'One'),
      await sharedRoute(ada.auth, 'public', 'Two'),
      await sharedRoute(ada.auth, 'public', 'Three'),
    ];
    const send = (auth: Auth, routeId: string) =>
      request(strict)
        .post(`/routes/${routeId}/reports`)
        .set(auth)
        .send({ reason: 'spam' });

    const statuses = [];
    for (const routeId of routes) {
      statuses.push((await send(bob.auth, routeId)).status);
    }
    const other = await send(carol.auth, routes[0]!);

    expect(statuses).toEqual([201, 201, 429]);
    expect(other.status).toBe(201);
  });
});

describe('admin access', () => {
  const adminEndpoints: [string, string][] = [
    ['get', '/admin/reports'],
    ['get', '/admin/routes/019a0000-0000-7000-8000-000000000000'],
    ['post', '/admin/routes/019a0000-0000-7000-8000-000000000000/hide'],
    ['post', '/admin/routes/019a0000-0000-7000-8000-000000000000/unhide'],
    [
      'post',
      '/admin/routes/019a0000-0000-7000-8000-000000000000/reports/dismiss',
    ],
    ['post', '/admin/reports/019a0000-0000-7000-8000-000000000000/dismiss'],
  ];

  it.each(adminEndpoints)(
    '%s %s needs a signed-in user',
    async (method, path) => {
      const response = await (
        request(app) as unknown as Record<string, (p: string) => request.Test>
      )[method]!(path).send({ reason: 'x' });

      expect(response.status).toBe(401);
    },
  );

  it.each(adminEndpoints)(
    '%s %s is closed to ordinary users',
    async (method, path) => {
      const ada = await signUp('ada');

      const response = await (
        request(app) as unknown as Record<string, (p: string) => request.Test>
      )[method]!(path)
        .set(ada.auth)
        .send({ reason: 'x' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('forbidden');
    },
  );

  it('lets an admin in', async () => {
    const admin = await signUpAdmin();

    const response = await request(app).get('/admin/reports').set(admin.auth);

    expect(response.status).toBe(200);
  });

  it('is decided by the database on every request, not by the token', async () => {
    const admin = await signUpAdmin();
    expect(
      (await request(app).get('/admin/reports').set(admin.auth)).status,
    ).toBe(200);

    // Same token, still valid: only the role changed.
    await db.user.update({
      where: { id: admin.userId },
      data: { role: 'USER' },
    });

    const response = await request(app).get('/admin/reports').set(admin.auth);
    expect(response.status).toBe(403);
  });

  it('rejects a valid token whose account was deleted', async () => {
    const admin = await signUpAdmin();
    await db.user.delete({ where: { id: admin.userId } });

    const response = await request(app).get('/admin/reports').set(admin.auth);

    expect(response.status).toBe(401);
  });

  it('does not reveal unknown admin paths', async () => {
    const response = await request(app).get('/admin/nothing-here');

    expect(response.status).toBe(404);
  });

  it('tells the web app who is an admin, and nobody else', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');

    const asAdmin = await request(app).get('/auth/me').set(admin.auth);
    const asUser = await request(app).get('/auth/me').set(ada.auth);

    expect(asAdmin.body.user.isAdmin).toBe(true);
    expect(asUser.body.user.isAdmin).toBe(false);
  });
});
