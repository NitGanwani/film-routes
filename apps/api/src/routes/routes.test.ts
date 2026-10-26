import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createFakeTmdb,
  createTestApp,
  createTestDb,
  resetDb,
} from '../test/helpers.js';

// Integration tests: they need the Postgres test database (see README).
const db = createTestDb();

beforeEach(() => resetDb(db));
afterAll(async () => {
  await resetDb(db);
  await db.$disconnect();
});

const tmdb = createFakeTmdb();
const app = createTestApp(db, { tmdb });

async function signUp(username: string) {
  const { body } = await request(app)
    .post('/auth/register')
    .send({
      username,
      email: `${username}@example.com`,
      password: 'correct horse battery staple',
    });
  return {
    userId: body.user.id as string,
    auth: { Authorization: `Bearer ${body.tokens.accessToken}` },
  };
}

type Auth = Awaited<ReturnType<typeof signUp>>['auth'];

async function createRoute(auth: Auth, body: object = { title: 'My route' }) {
  const response = await request(app).post('/routes').set(auth).send(body);
  return response.body.route.id as string;
}

const addStep = (auth: Auth, routeId: string, body: object) =>
  request(app).post(`/routes/${routeId}/steps`).set(auth).send(body);

/** Creates a route holding the given films, in order. */
async function routeWith(auth: Auth, tmdbIds: number[]) {
  const routeId = await createRoute(auth);
  for (const tmdbId of tmdbIds) {
    await addStep(auth, routeId, { tmdbId });
  }
  const { body } = await request(app).get(`/routes/${routeId}`).set(auth);
  return {
    routeId,
    steps: body.route.steps as { id: string; position: number }[],
  };
}

const filmOrder = (route: { steps: { film: { tmdbId: number } }[] }) =>
  route.steps.map((step) => step.film.tmdbId);

describe('POST /routes', () => {
  it('requires a signed-in user', async () => {
    expect(
      (await request(app).post('/routes').send({ title: 'x' })).status,
    ).toBe(401);
  });

  it('creates a private, empty route in the author locale', async () => {
    const { auth } = await signUp('ada');

    const response = await request(app)
      .post('/routes')
      .set(auth)
      .send({ title: '  First steps in horror  ', description: '' });

    expect(response.status).toBe(201);
    expect(response.body.route).toMatchObject({
      title: 'First steps in horror',
      description: null,
      locale: 'es',
      visibility: 'private',
      locked: false,
      steps: [],
    });
  });

  it('accepts an explicit locale and validates the input', async () => {
    const { auth } = await signUp('ada');

    const english = await request(app)
      .post('/routes')
      .set(auth)
      .send({ title: 'A route', locale: 'en' });
    expect(english.body.route.locale).toBe('en');

    for (const body of [
      {},
      { title: '' },
      { title: 'x'.repeat(121) },
      { title: 'ok', locale: 'fr' },
    ]) {
      const response = await request(app).post('/routes').set(auth).send(body);
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe('reading routes', () => {
  it('lists only my own routes, newest activity first', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    await createRoute(ada.auth, { title: 'Old' });
    await createRoute(ada.auth, { title: 'Recent' });
    await createRoute(bob.auth, { title: 'Bobs' });

    const response = await request(app).get('/routes').set(ada.auth);

    expect(response.body.routes.map((r: { title: string }) => r.title)).toEqual(
      ['Recent', 'Old'],
    );
    expect(response.body.routes[0]).toMatchObject({
      stepCount: 0,
      locked: false,
    });
  });

  it('hides other peoples routes behind a 404 and rejects bad ids', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await createRoute(ada.auth);

    const asOwner = await request(app).get(`/routes/${routeId}`).set(ada.auth);
    const asOther = await request(app).get(`/routes/${routeId}`).set(bob.auth);
    const badId = await request(app).get('/routes/not-a-uuid').set(ada.auth);

    expect(asOwner.status).toBe(200);
    expect(asOther.status).toBe(404);
    expect(asOther.body.error.code).toBe('route_not_found');
    expect(badId.status).toBe(400);
  });
});

describe('PATCH /routes/:id', () => {
  it('changes the title and clears the description with null', async () => {
    const { auth } = await signUp('ada');
    const routeId = await createRoute(auth, {
      title: 'Old title',
      description: 'Old description',
    });

    const response = await request(app)
      .patch(`/routes/${routeId}`)
      .set(auth)
      .send({ title: 'New title', description: null });

    expect(response.status).toBe(200);
    expect(response.body.route).toMatchObject({
      title: 'New title',
      description: null,
    });
  });

  it('rejects an empty patch and other peoples routes', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await createRoute(ada.auth);

    const empty = await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({});
    const stranger = await request(app)
      .patch(`/routes/${routeId}`)
      .set(bob.auth)
      .send({ title: 'Mine now' });

    expect(empty.status).toBe(400);
    expect(stranger.status).toBe(404);
  });

  it('only lets a route with at least two films be shared', async () => {
    const { auth } = await signUp('ada');
    const { routeId } = await routeWith(auth, [603]);
    const publish = () =>
      request(app)
        .patch(`/routes/${routeId}`)
        .set(auth)
        .send({ visibility: 'unlisted' });

    const tooShort = await publish();
    await addStep(auth, routeId, { tmdbId: 1 });
    const shared = await publish();

    expect(tooShort.status).toBe(409);
    expect(tooShort.body.error.code).toBe('route_too_short');
    expect(shared.status).toBe(200);
    expect(shared.body.route.visibility).toBe('unlisted');
  });
});

describe('POST /routes/:id/steps', () => {
  it('adds films in order, storing each chosen film', async () => {
    const { auth } = await signUp('ada');
    const routeId = await createRoute(auth);

    const first = await addStep(auth, routeId, {
      tmdbId: 603,
      noteBefore: ' Watch the lobby scene ',
      noteAfter: '',
      authorEmotion: 'awe',
    });
    const second = await addStep(auth, routeId, { tmdbId: 1 });

    expect(first.status).toBe(201);
    expect(
      second.body.route.steps.map((s: { position: number }) => s.position),
    ).toEqual([1, 2]);
    expect(first.body.route.steps[0]).toMatchObject({
      position: 1,
      noteBefore: 'Watch the lobby scene',
      noteAfter: null,
      authorEmotion: 'awe',
      film: { tmdbId: 603, title: 'Matrix', releaseYear: 1999 },
    });
    expect(await db.film.count()).toBe(2);
  });

  it('shows film titles in the language of the route', async () => {
    const { auth } = await signUp('ada');
    const routeId = await createRoute(auth, { title: 'Route', locale: 'en' });

    const response = await addStep(auth, routeId, { tmdbId: 603 });

    expect(response.body.route.steps[0].film.title).toBe('The Matrix');
  });

  it('rejects a repeated film, an unknown film and bad input', async () => {
    const { auth } = await signUp('ada');
    const routeId = await createRoute(auth);
    await addStep(auth, routeId, { tmdbId: 603 });

    const repeated = await addStep(auth, routeId, { tmdbId: 603 });
    const unknown = await addStep(auth, routeId, { tmdbId: 999 });
    const badEmotion = await addStep(auth, routeId, {
      tmdbId: 1,
      authorEmotion: 'rage',
    });
    const longNote = await addStep(auth, routeId, {
      tmdbId: 1,
      noteBefore: 'x'.repeat(1001),
    });

    expect(repeated.status).toBe(409);
    expect(repeated.body.error.code).toBe('film_already_in_route');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('film_not_found');
    expect(badEmotion.status).toBe(400);
    expect(longNote.status).toBe(400);
  });

  it('stops at 12 films', async () => {
    const { auth } = await signUp('ada');
    const { routeId } = await routeWith(
      auth,
      Array.from({ length: 12 }, (_, i) => i + 1),
    );

    const thirteenth = await addStep(auth, routeId, { tmdbId: 13 });

    expect(thirteenth.status).toBe(409);
    expect(thirteenth.body.error.code).toBe('route_full');
  });

  it('does not contact TMDB for a route that is not yours', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await createRoute(ada.auth);
    tmdb.getMovie.mockClear();

    const response = await addStep(bob.auth, routeId, { tmdbId: 603 });

    expect(response.status).toBe(404);
    expect(tmdb.getMovie).not.toHaveBeenCalled();
  });

  it('keeps the limit and the order when two films are added at once', async () => {
    const { auth } = await signUp('ada');
    const full = await routeWith(
      auth,
      Array.from({ length: 11 }, (_, i) => i + 1),
    );
    const empty = await createRoute(auth);

    // One slot left: exactly one of the two simultaneous requests wins.
    const race = await Promise.all([
      addStep(auth, full.routeId, { tmdbId: 20 }),
      addStep(auth, full.routeId, { tmdbId: 21 }),
    ]);
    // Two films into an empty route: both fit, with distinct positions.
    await Promise.all([
      addStep(auth, empty, { tmdbId: 30 }),
      addStep(auth, empty, { tmdbId: 31 }),
    ]);

    expect(race.map((r) => r.status).sort()).toEqual([201, 409]);
    const positions = await db.routeStep.findMany({
      where: { routeId: empty },
      orderBy: { position: 'asc' },
      select: { position: true },
    });
    expect(positions.map((p) => p.position)).toEqual([1, 2]);
  });
});

describe('PATCH /routes/:id/steps/:stepId', () => {
  it('edits notes and emotion, and null clears them', async () => {
    const { auth } = await signUp('ada');
    const { routeId, steps } = await routeWith(auth, [603]);
    const url = `/routes/${routeId}/steps/${steps[0]!.id}`;

    const edited = await request(app)
      .patch(url)
      .set(auth)
      .send({ noteBefore: 'Before', noteAfter: 'After', authorEmotion: 'joy' });
    const cleared = await request(app)
      .patch(url)
      .set(auth)
      .send({ noteAfter: null, authorEmotion: null });

    expect(edited.body.route.steps[0]).toMatchObject({
      noteBefore: 'Before',
      noteAfter: 'After',
      authorEmotion: 'joy',
    });
    expect(cleared.body.route.steps[0]).toMatchObject({
      noteBefore: 'Before',
      noteAfter: null,
      authorEmotion: null,
    });
  });

  it('404s for a step of another route and 400s for an empty patch', async () => {
    const { auth } = await signUp('ada');
    const one = await routeWith(auth, [603]);
    const two = await routeWith(auth, [1]);

    const wrongRoute = await request(app)
      .patch(`/routes/${one.routeId}/steps/${two.steps[0]!.id}`)
      .set(auth)
      .send({ noteBefore: 'x' });
    const empty = await request(app)
      .patch(`/routes/${one.routeId}/steps/${one.steps[0]!.id}`)
      .set(auth)
      .send({});

    expect(wrongRoute.status).toBe(404);
    expect(wrongRoute.body.error.code).toBe('step_not_found');
    expect(empty.status).toBe(400);
  });
});

describe('PUT /routes/:id/steps/order', () => {
  it('swaps two films despite the unique (route, position) rule', async () => {
    const { auth } = await signUp('ada');
    const { routeId, steps } = await routeWith(auth, [1, 2, 3]);
    const [a, b, c] = steps.map((s) => s.id);

    const response = await request(app)
      .put(`/routes/${routeId}/steps/order`)
      .set(auth)
      .send({ stepIds: [b, a, c] });

    expect(response.status).toBe(200);
    expect(filmOrder(response.body.route)).toEqual([2, 1, 3]);
    const stored = await db.routeStep.findMany({
      where: { routeId },
      orderBy: { position: 'asc' },
      select: { position: true },
    });
    expect(stored.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it('keeps step ids, so progress would survive a reorder', async () => {
    const { auth } = await signUp('ada');
    const { routeId, steps } = await routeWith(auth, [1, 2]);

    const response = await request(app)
      .put(`/routes/${routeId}/steps/order`)
      .set(auth)
      .send({ stepIds: [steps[1]!.id, steps[0]!.id] });

    const ids = response.body.route.steps.map((s: { id: string }) => s.id);
    expect(ids.sort()).toEqual(steps.map((s) => s.id).sort());
  });

  it('requires every step exactly once', async () => {
    const { auth } = await signUp('ada');
    const { routeId, steps } = await routeWith(auth, [1, 2, 3]);
    const other = await routeWith(auth, [4]);
    const [a, b] = steps.map((s) => s.id);

    const attempts = [
      [a], // missing steps
      [a, a, b], // repeated step
      [a, b, other.steps[0]!.id], // a step of another route
    ];
    for (const stepIds of attempts) {
      const response = await request(app)
        .put(`/routes/${routeId}/steps/order`)
        .set(auth)
        .send({ stepIds });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('invalid_order');
    }
  });
});

describe('DELETE /routes/:id/steps/:stepId', () => {
  it('removes a step and closes the gap', async () => {
    const { auth } = await signUp('ada');
    const { routeId, steps } = await routeWith(auth, [1, 2, 3]);

    const response = await request(app)
      .delete(`/routes/${routeId}/steps/${steps[0]!.id}`)
      .set(auth);

    expect(response.status).toBe(200);
    expect(filmOrder(response.body.route)).toEqual([2, 3]);
    expect(
      response.body.route.steps.map((s: { position: number }) => s.position),
    ).toEqual([1, 2]);
  });

  it('will not leave a shared route with fewer than two films', async () => {
    const { auth } = await signUp('ada');
    const { routeId, steps } = await routeWith(auth, [1, 2]);
    await request(app)
      .patch(`/routes/${routeId}`)
      .set(auth)
      .send({ visibility: 'public' });

    const response = await request(app)
      .delete(`/routes/${routeId}/steps/${steps[0]!.id}`)
      .set(auth);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('route_too_short');
  });
});

describe('DELETE /routes/:id', () => {
  it('deletes the route with its steps; others get a 404', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const { routeId } = await routeWith(ada.auth, [1, 2]);

    const stranger = await request(app)
      .delete(`/routes/${routeId}`)
      .set(bob.auth);
    const owner = await request(app).delete(`/routes/${routeId}`).set(ada.auth);

    expect(stranger.status).toBe(404);
    expect(owner.status).toBe(204);
    expect(await db.route.count()).toBe(0);
    expect(await db.routeStep.count()).toBe(0);
  });
});

describe('a route with travelers is locked', () => {
  async function lockedRoute() {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const { routeId, steps } = await routeWith(ada.auth, [1, 2, 3]);
    await db.enrollment.create({
      data: { routeId, travelerId: bob.userId },
    });
    return { auth: ada.auth, routeId, steps };
  }

  it('refuses to add, remove or reorder films, or delete the route', async () => {
    const { auth, routeId, steps } = await lockedRoute();
    const [a, b, c] = steps.map((s) => s.id);

    const responses = await Promise.all([
      addStep(auth, routeId, { tmdbId: 4 }),
      request(app).delete(`/routes/${routeId}/steps/${a}`).set(auth),
      request(app)
        .put(`/routes/${routeId}/steps/order`)
        .set(auth)
        .send({ stepIds: [c, b, a] }),
      request(app).delete(`/routes/${routeId}`).set(auth),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('route_locked');
    }
    expect(await db.routeStep.count({ where: { routeId } })).toBe(3);
  });

  it('still lets the author fix notes, title and description', async () => {
    const { auth, routeId, steps } = await lockedRoute();

    const note = await request(app)
      .patch(`/routes/${routeId}/steps/${steps[0]!.id}`)
      .set(auth)
      .send({ noteAfter: 'A better note' });
    const title = await request(app)
      .patch(`/routes/${routeId}`)
      .set(auth)
      .send({ title: 'Better title' });

    expect(note.status).toBe(200);
    expect(note.body.route.locked).toBe(true);
    expect(title.status).toBe(200);
  });
});
