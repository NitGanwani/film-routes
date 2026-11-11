import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestApp,
  createTestDb,
  resetDb,
  markVerified,
} from '../test/helpers.js';

// Integration tests: they need the Postgres test database (see README).
const db = createTestDb();
const app = createTestApp(db);

beforeEach(() => resetDb(db));
afterAll(async () => {
  await resetDb(db);
  await db.$disconnect();
});

async function signUp(username: string) {
  const { body } = await request(app)
    .post('/auth/register')
    .send({
      username,
      email: `${username}@example.com`,
      password: 'correct horse battery staple',
    });
  await markVerified(db, body.user.id as string);
  return {
    userId: body.user.id as string,
    auth: { Authorization: `Bearer ${body.tokens.accessToken}` },
  };
}

type Auth = Awaited<ReturnType<typeof signUp>>['auth'];

/** A route of three films with notes, in the given visibility. */
async function routeOf(
  auth: Auth,
  visibility: 'private' | 'unlisted' | 'public',
  title = 'Horror for beginners',
) {
  const created = await request(app)
    .post('/routes')
    .set(auth)
    .send({ title, description: 'Three films to lose the fear' });
  const routeId = created.body.route.id as string;
  for (const [index, tmdbId] of [1, 2, 3].entries()) {
    await request(app)
      .post(`/routes/${routeId}/steps`)
      .set(auth)
      .send({
        tmdbId,
        noteBefore: `before-${index + 1}`,
        noteAfter: `after-${index + 1}`,
        authorEmotion: 'joy',
      });
  }
  if (visibility !== 'private') {
    await request(app)
      .patch(`/routes/${routeId}`)
      .set(auth)
      .send({ visibility });
  }
  return routeId;
}

const publicRoute = (auth: Auth, title?: string) =>
  routeOf(auth, 'public', title);

const joinPublic = (auth: Auth, routeId: string) =>
  request(app).post(`/public/routes/${routeId}/join`).set(auth);

/** Closes every film of the route as this traveler, completing it. */
async function complete(auth: Auth, routeId: string) {
  const journey = await request(app)
    .get(`/routes/${routeId}/journey`)
    .set(auth);
  for (const step of journey.body.journey.steps as { id: string }[]) {
    await request(app)
      .post(`/routes/${routeId}/journey/steps/${step.id}/close`)
      .set(auth)
      .send({ emotion: 'joy' });
  }
}

type Summary = { id: string; title: string; completions: number };

const titles = (body: { routes: Summary[] }) =>
  body.routes.map((route) => route.title);

describe('the public list', () => {
  /** Writes a route in English (routes are Spanish by default). */
  const inEnglish = (routeId: string) =>
    db.route.update({ where: { id: routeId }, data: { locale: 'EN' } });

  it('can be limited to one language, in every ordering', async () => {
    const ada = await signUp('ada');
    await publicRoute(ada.auth, 'Ruta en español');
    const english = await publicRoute(ada.auth, 'Route in English');
    await inEnglish(english);

    for (const sort of ['new', 'popular']) {
      const en = await request(app).get(
        `/public/routes?sort=${sort}&locale=en`,
      );
      const es = await request(app).get(
        `/public/routes?sort=${sort}&locale=es`,
      );
      const all = await request(app).get(`/public/routes?sort=${sort}`);

      expect(titles(en.body)).toEqual(['Route in English']);
      expect(en.body.total).toBe(1);
      expect(titles(es.body)).toEqual(['Ruta en español']);
      expect(es.body.total).toBe(1);
      expect(all.body.total).toBe(2);
    }
  });

  it('refuses a language it does not know', async () => {
    const response = await request(app).get('/public/routes?locale=fr');

    expect(response.status).toBe(400);
  });

  it('needs no account', async () => {
    const ada = await signUp('ada');
    await publicRoute(ada.auth);

    const response = await request(app).get('/public/routes');

    expect(response.status).toBe(200);
    expect(response.body.routes).toHaveLength(1);
  });

  it('lists only public routes', async () => {
    const ada = await signUp('ada');
    await publicRoute(ada.auth, 'Public one');
    await routeOf(ada.auth, 'unlisted', 'Unlisted one');
    await routeOf(ada.auth, 'private', 'Private one');

    const response = await request(app).get('/public/routes');

    expect(titles(response.body)).toEqual(['Public one']);
    expect(response.body.total).toBe(1);
  });

  it('shows what is needed to choose a route, and nothing private', async () => {
    const ada = await signUp('ada');
    await publicRoute(ada.auth);

    const response = await request(app).get('/public/routes');

    expect(response.body.routes[0]).toMatchObject({
      title: 'Horror for beginners',
      description: 'Three films to lose the fear',
      author: 'ada',
      locale: 'es',
      stepCount: 3,
      completions: 0,
    });
    const text = JSON.stringify(response.body);
    expect(text).not.toContain('before-');
    expect(text).not.toContain('after-');
    expect(text).not.toContain('ada@example.com');
  });

  it('shows the first four posters of each route, in route order', async () => {
    const ada = await signUp('ada');
    const created = await request(app)
      .post('/routes')
      .set(ada.auth)
      .send({ title: 'Many films' });
    const routeId = created.body.route.id as string;
    // Film 603 is the only stand-in film that has a poster.
    let stepIds: string[] = [];
    for (const tmdbId of [1, 603, 2, 3, 4]) {
      const added = await request(app)
        .post(`/routes/${routeId}/steps`)
        .set(ada.auth)
        .send({ tmdbId });
      // Every answer is the whole route; the last one has all five films.
      stepIds = (added.body.route.steps as { id: string }[]).map((s) => s.id);
    }
    await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'public' });
    const matrixPoster = 'https://image.tmdb.org/t/p/w185/matrix.jpg';

    const before = await request(app).get('/public/routes');
    expect(before.body.routes[0].posters).toEqual([
      null,
      matrixPoster,
      null,
      null,
    ]);
    // The cover is the first film's backdrop, and that film has none.
    expect(before.body.routes[0].coverUrl).toBeNull();

    // Moving a film moves its poster: the order is the route's, not the database's.
    await request(app)
      .put(`/routes/${routeId}/steps/order`)
      .set(ada.auth)
      .send({ stepIds: [stepIds[1], stepIds[0], ...stepIds.slice(2)] });
    const after = await request(app).get('/public/routes');
    expect(after.body.routes[0].posters).toEqual([
      matrixPoster,
      null,
      null,
      null,
    ]);
    // Now the first film is the Matrix, so the cover is its backdrop.
    const cover = 'https://image.tmdb.org/t/p/w1280/matrix-backdrop.jpg';
    expect(after.body.routes[0].coverUrl).toBe(cover);

    // The route page agrees, and still lists every film.
    const detail = await request(app).get(`/public/routes/${routeId}`);
    expect(detail.body.route.posters).toEqual(after.body.routes[0].posters);
    expect(detail.body.route.coverUrl).toBe(cover);
    expect(detail.body.route.steps).toHaveLength(5);
  });

  it('puts the newest first by default', async () => {
    const ada = await signUp('ada');
    await publicRoute(ada.auth, 'First');
    await publicRoute(ada.auth, 'Second');
    await publicRoute(ada.auth, 'Third');

    const response = await request(app).get('/public/routes');

    expect(titles(response.body)).toEqual(['Third', 'Second', 'First']);
  });

  it('can rank by most completed, newest first among ties', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const carol = await signUp('carol');
    const quiet = await publicRoute(ada.auth, 'Quiet');
    const loved = await publicRoute(ada.auth, 'Loved');
    await publicRoute(ada.auth, 'Newest');
    for (const traveler of [bob, carol]) {
      await joinPublic(traveler.auth, loved);
      await complete(traveler.auth, loved);
    }
    // Someone who joined but did not finish does not count.
    await joinPublic(bob.auth, quiet);

    const response = await request(app).get('/public/routes?sort=popular');

    expect(titles(response.body)).toEqual(['Loved', 'Newest', 'Quiet']);
    expect(response.body.routes[0].completions).toBe(2);
    expect(response.body.routes[2].completions).toBe(0);
  });

  it('paginates', async () => {
    const ada = await signUp('ada');
    for (const title of ['One', 'Two', 'Three']) {
      await publicRoute(ada.auth, title);
    }

    const first = await request(app).get('/public/routes?pageSize=2');
    const second = await request(app).get('/public/routes?pageSize=2&page=2');
    const beyond = await request(app).get('/public/routes?pageSize=2&page=3');

    expect(titles(first.body)).toEqual(['Three', 'Two']);
    expect(titles(second.body)).toEqual(['One']);
    expect(beyond.body.routes).toEqual([]);
    expect(first.body).toMatchObject({ page: 1, pageSize: 2, total: 3 });
  });

  it('paginates the ranking too, without repeating routes', async () => {
    const ada = await signUp('ada');
    for (const title of ['One', 'Two', 'Three']) {
      await publicRoute(ada.auth, title);
    }

    const first = await request(app).get(
      '/public/routes?sort=popular&pageSize=2',
    );
    const second = await request(app).get(
      '/public/routes?sort=popular&pageSize=2&page=2',
    );

    const seen = [...titles(first.body), ...titles(second.body)];
    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(3);
  });

  it('refuses a malformed request', async () => {
    for (const query of [
      'sort=best',
      'page=0',
      'page=101',
      'page=abc',
      'pageSize=0',
      'pageSize=51',
      'pageSize=1.5',
    ]) {
      const response = await request(app).get(`/public/routes?${query}`);
      expect(response.status, query).toBe(400);
    }
  });

  it('is cached briefly so repeated visits are cheap', async () => {
    const response = await request(app).get('/public/routes');

    expect(response.headers['cache-control']).toBe('public, max-age=30');
  });

  it('stops listing a route as soon as it is unpublished', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);

    await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'private' });
    const response = await request(app).get('/public/routes');

    expect(response.body.routes).toEqual([]);
  });
});

describe('a public route before starting it', () => {
  it('shows the films in order but none of the notes', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);

    const response = await request(app).get(`/public/routes/${routeId}`);

    expect(response.status).toBe(200);
    expect(response.body.route).toMatchObject({
      title: 'Horror for beginners',
      author: 'ada',
      stepCount: 3,
      completions: 0,
    });
    expect(
      response.body.route.steps.map(
        (step: { position: number; film: { title: string } }) => [
          step.position,
          step.film.title,
        ],
      ),
    ).toEqual([
      [1, 'Película 1'],
      [2, 'Película 2'],
      [3, 'Película 3'],
    ]);
    const text = JSON.stringify(response.body);
    expect(text).not.toContain('before-');
    expect(text).not.toContain('after-');
    expect(text).not.toContain('noteBefore');
    expect(text).not.toContain('authorEmotion');
  });

  it('gives every film title in both languages, plus one in the route language', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);

    const spanish = await request(app).get(`/public/routes/${routeId}`);
    await db.route.update({ where: { id: routeId }, data: { locale: 'EN' } });
    const english = await request(app).get(`/public/routes/${routeId}`);

    const film = (response: typeof spanish) =>
      response.body.route.steps[0].film;
    expect(film(spanish).title).toBe('Película 1');
    expect(film(english).title).toBe('Film 1');
    for (const response of [spanish, english]) {
      expect(film(response).titles).toEqual({
        es: 'Película 1',
        en: 'Film 1',
      });
    }
  });

  it('does not exist unless the route is public', async () => {
    const ada = await signUp('ada');
    const unlisted = await routeOf(ada.auth, 'unlisted');
    const hidden = await routeOf(ada.auth, 'private');

    for (const id of [
      unlisted,
      hidden,
      '01a19db3-e7f0-7320-a66c-03fffe179351',
    ]) {
      const response = await request(app).get(`/public/routes/${id}`);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('route_not_found');
    }
  });

  it('rejects a malformed id', async () => {
    const response = await request(app).get('/public/routes/not-a-uuid');

    expect(response.status).toBe(400);
  });

  it('counts the people who completed it', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await publicRoute(ada.auth);
    await joinPublic(bob.auth, routeId);
    await complete(bob.auth, routeId);

    const response = await request(app).get(`/public/routes/${routeId}`);

    expect(response.body.route.completions).toBe(1);
  });
});

describe('starting a public route without an invitation', () => {
  it('requires a signed-in user', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);

    const response = await request(app).post(`/public/routes/${routeId}/join`);

    expect(response.status).toBe(401);
  });

  it('enrolls the traveler, who then follows it like any other route', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await publicRoute(ada.auth);

    const response = await joinPublic(bob.auth, routeId);
    const journey = await request(app)
      .get(`/routes/${routeId}/journey`)
      .set(bob.auth);

    expect(response.status).toBe(201);
    expect(response.body.enrollment.status).toBe('active');
    expect(response.body.route).toMatchObject({
      title: 'Horror for beginners',
      author: 'ada',
      stepCount: 3,
    });
    expect(JSON.stringify(response.body)).not.toContain('before-');
    expect(journey.status).toBe(200);
    const stored = await db.enrollment.findFirstOrThrow({
      where: { routeId, travelerId: bob.userId },
    });
    expect(stored.inviteId).toBeNull();
  });

  it('is harmless to repeat', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await publicRoute(ada.auth);

    const first = await joinPublic(bob.auth, routeId);
    const again = await joinPublic(bob.auth, routeId);

    expect(again.status).toBe(200);
    expect(again.body.enrollment.id).toBe(first.body.enrollment.id);
    expect(await db.enrollment.count({ where: { routeId } })).toBe(1);
  });

  it('is not possible for a route that is only shared by link', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const unlisted = await routeOf(ada.auth, 'unlisted');
    const hidden = await routeOf(ada.auth, 'private');

    for (const id of [unlisted, hidden]) {
      const response = await joinPublic(bob.auth, id);
      expect(response.status).toBe(404);
    }
    expect(await db.enrollment.count()).toBe(0);
  });

  it('cannot be done by the author', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);

    const response = await joinPublic(ada.auth, routeId);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('cannot_join_own_route');
  });

  it('keeps out someone the author removed', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await publicRoute(ada.auth);
    const joined = await joinPublic(bob.auth, routeId);
    await request(app)
      .delete(`/routes/${routeId}/travelers/${joined.body.enrollment.id}`)
      .set(ada.auth);

    const response = await joinPublic(bob.auth, routeId);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('removed_from_route');
  });

  it('brings back someone who left, with their progress', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await publicRoute(ada.auth);
    const joined = await joinPublic(bob.auth, routeId);
    const journey = await request(app)
      .get(`/routes/${routeId}/journey`)
      .set(bob.auth);
    const firstStep = journey.body.journey.steps[0].id as string;
    await request(app)
      .post(`/routes/${routeId}/journey/steps/${firstStep}/close`)
      .set(bob.auth)
      .send({ emotion: 'awe' });
    await request(app).post(`/routes/${routeId}/journey/leave`).set(bob.auth);

    const back = await joinPublic(bob.auth, routeId);
    const after = await request(app)
      .get(`/routes/${routeId}/journey`)
      .set(bob.auth);

    expect(back.status).toBe(200);
    expect(back.body.enrollment).toMatchObject({
      id: joined.body.enrollment.id,
      status: 'active',
    });
    expect(after.body.journey.steps[0].myEmotion).toBe('awe');
  });

  it('locks the films of the route, as joining by link does', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await publicRoute(ada.auth);
    await joinPublic(bob.auth, routeId);

    const response = await request(app)
      .post(`/routes/${routeId}/steps`)
      .set(ada.auth)
      .send({ tmdbId: 4 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('route_locked');
  });

  it('closes the door to newcomers once unpublished, not to those inside', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const carol = await signUp('carol');
    const routeId = await publicRoute(ada.auth);
    await joinPublic(bob.auth, routeId);

    await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'private' });
    const newcomer = await joinPublic(carol.auth, routeId);
    await complete(bob.auth, routeId);
    const bobStatus = await request(app)
      .get(`/routes/${routeId}/journey`)
      .set(bob.auth);

    expect(newcomer.status).toBe(404);
    expect(bobStatus.body.journey.enrollment.status).toBe('completed');
  });

  it('enrolls once when the same person joins twice at the same instant', async () => {
    // Repeated: this race only shows up some of the time.
    for (let round = 0; round < 8; round += 1) {
      await resetDb(db);
      const ada = await signUp('ada');
      const bob = await signUp('bob');
      const routeId = await publicRoute(ada.auth);

      const results = await Promise.all([
        joinPublic(bob.auth, routeId),
        joinPublic(bob.auth, routeId),
      ]);

      expect(
        results.map((result) => result.status).sort(),
        `round ${round}`,
      ).toEqual([200, 201]);
      expect(await db.enrollment.count({ where: { routeId } })).toBe(1);
    }
  });

  it('lets many different people join at once', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);
    const travelers = await Promise.all(
      ['bob', 'carol', 'dan', 'erin', 'frank', 'gina'].map(signUp),
    );

    const results = await Promise.all(
      travelers.map((traveler) => joinPublic(traveler.auth, routeId)),
    );

    expect(results.map((result) => result.status)).toEqual(
      travelers.map(() => 201),
    );
    expect(await db.enrollment.count({ where: { routeId } })).toBe(
      travelers.length,
    );
  });
});

describe('abuse protection', () => {
  it('limits how often one address can ask', async () => {
    const limited = createTestApp(db, { publicRequestsPerMinute: 2 });

    const statuses: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      statuses.push((await request(limited).get('/public/routes')).status);
    }

    expect(statuses).toEqual([200, 200, 429]);
  });
});
