import { RATING } from '@film-routes/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, createTestDb, resetDb } from '../test/helpers.js';

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
  return {
    userId: body.user.id as string,
    auth: { Authorization: `Bearer ${body.tokens.accessToken}` },
  };
}

type Auth = Awaited<ReturnType<typeof signUp>>['auth'];

/** A public route of three films. */
async function publicRoute(auth: Auth) {
  const created = await request(app)
    .post('/routes')
    .set(auth)
    .send({ title: 'Horror for beginners' });
  const routeId = created.body.route.id as string;
  for (const tmdbId of [1, 2, 3]) {
    await request(app)
      .post(`/routes/${routeId}/steps`)
      .set(auth)
      .send({ tmdbId });
  }
  await request(app)
    .patch(`/routes/${routeId}`)
    .set(auth)
    .send({ visibility: 'public' });
  return routeId;
}

const join = (auth: Auth, routeId: string) =>
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

/** Someone who joined and finished the route. */
async function finisher(username: string, routeId: string) {
  const user = await signUp(username);
  await join(user.auth, routeId);
  await complete(user.auth, routeId);
  return user;
}

const rate = (auth: Auth, routeId: string, body: object) =>
  request(app).put(`/routes/${routeId}/rating`).set(auth).send(body);

const myRating = (auth: Auth, routeId: string) =>
  request(app).get(`/routes/${routeId}/rating`).set(auth);

const publicSummary = async (routeId: string) =>
  (await request(app).get(`/public/routes/${routeId}`)).body.route.rating as {
    average: number | null;
    votes: number;
  };

/** Votes from as many new people as there are scores, each finishing first. */
async function voteAll(routeId: string, scores: number[]) {
  for (const [index, score] of scores.entries()) {
    const voter = await finisher(`voter${index}`, routeId);
    await rate(voter.auth, routeId, { score });
  }
}

describe('who can vote', () => {
  it('requires a signed-in user', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);

    const response = await request(app)
      .put(`/routes/${routeId}/rating`)
      .send({ score: 8 });

    expect(response.status).toBe(401);
  });

  it('is only for people who completed the route', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await publicRoute(ada.auth);
    await join(bob.auth, routeId);

    const response = await rate(bob.auth, routeId, { score: 8 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('route_not_completed');
    expect(await db.routeRating.count()).toBe(0);
  });

  it('is not for people who never joined, nor for the author', async () => {
    const ada = await signUp('ada');
    const carol = await signUp('carol');
    const routeId = await publicRoute(ada.auth);

    const stranger = await rate(carol.auth, routeId, { score: 8 });
    const author = await rate(ada.auth, routeId, { score: 10 });

    expect(stranger.status).toBe(404);
    expect(author.status).toBe(404);
    expect(await db.routeRating.count()).toBe(0);
  });

  it('works once the route is completed', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);
    const bob = await finisher('bob', routeId);

    const response = await rate(bob.auth, routeId, { score: 8 });

    expect(response.status).toBe(200);
    expect(response.body.rating).toEqual({ score: 8 });
    const stored = await db.routeRating.findFirstOrThrow({
      where: { routeId, userId: bob.userId },
    });
    expect(stored.score).toBe(8);
  });

  it('keeps a vote and the completion when the author removes the traveler', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);
    const bob = await finisher('bob', routeId);
    await rate(bob.auth, routeId, { score: 2 });
    const travelers = await request(app)
      .get(`/routes/${routeId}/travelers`)
      .set(ada.auth);

    await request(app)
      .delete(`/routes/${routeId}/travelers/${travelers.body.travelers[0].id}`)
      .set(ada.auth);
    const again = await rate(bob.auth, routeId, { score: 9 });
    const detail = await request(app).get(`/public/routes/${routeId}`);

    // Removing someone cannot be used to erase their bad vote...
    expect(await db.routeRating.count()).toBe(1);
    expect(detail.body.route.rating.votes).toBe(1);
    expect(detail.body.route.completions).toBe(1);
    // ...and they cannot keep voting or change it.
    expect(again.status).toBe(403);
    expect(again.body.error.code).toBe('removed_from_route');
    expect((await db.routeRating.findFirstOrThrow()).score).toBe(2);
  });
});

describe('the score', () => {
  it('accepts whole numbers from 1 to 10 only', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);
    const bob = await finisher('bob', routeId);

    for (const body of [
      {},
      { score: 0 },
      { score: RATING.max + 1 },
      { score: -3 },
      { score: 7.5 },
      { score: '8' },
      { score: null },
      { stars: 4 },
    ]) {
      const response = await rate(bob.auth, routeId, body);
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    expect(await db.routeRating.count()).toBe(0);

    for (const score of [RATING.min, RATING.max]) {
      const response = await rate(bob.auth, routeId, { score });
      expect(response.status, String(score)).toBe(200);
    }
  });

  it('can be changed, and never counts twice', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);
    const bob = await finisher('bob', routeId);

    await rate(bob.auth, routeId, { score: 4 });
    const changed = await rate(bob.auth, routeId, { score: 9 });

    expect(changed.status).toBe(200);
    expect(await db.routeRating.count({ where: { routeId } })).toBe(1);
    expect((await myRating(bob.auth, routeId)).body.rating).toEqual({
      score: 9,
    });
  });

  it('is only ever one vote per person, even if sent at the same instant', async () => {
    for (let round = 0; round < 8; round += 1) {
      await resetDb(db);
      const ada = await signUp('ada');
      const routeId = await publicRoute(ada.auth);
      const bob = await finisher('bob', routeId);

      const results = await Promise.all([
        rate(bob.auth, routeId, { score: 3 }),
        rate(bob.auth, routeId, { score: 7 }),
      ]);

      expect(
        results.map((result) => result.status),
        `round ${round}`,
      ).toEqual([200, 200]);
      expect(await db.routeRating.count({ where: { routeId } })).toBe(1);
    }
  });
});

describe('the overall score', () => {
  it('is hidden until enough people have voted, but the votes are counted', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);

    const belowMinimum = RATING.minVotesToShowAverage - 1;
    await voteAll(routeId, Array<number>(belowMinimum).fill(10));
    const few = await publicSummary(routeId);

    expect(few).toEqual({ average: null, votes: belowMinimum });
  });

  it('is the average with one decimal once there are enough votes', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);

    await voteAll(routeId, [10, 9, 8, 7, 7]);
    const summary = await publicSummary(routeId);

    // (10 + 9 + 8 + 7 + 7) / 5 = 8.2
    expect(summary).toEqual({ average: 8.2, votes: 5 });
  });

  it('rounds half up to one decimal', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);

    // 58 / 8 = 7.25, which must show as 7.3.
    await voteAll(routeId, [8, 8, 7, 7, 7, 7, 7, 7]);
    const summary = await publicSummary(routeId);

    expect(summary).toEqual({ average: 7.3, votes: 8 });
  });

  it('follows the votes when someone changes theirs', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);
    await voteAll(routeId, [10, 10, 10, 10, 10]);
    expect((await publicSummary(routeId)).average).toBe(10);

    const login = await request(app).post('/auth/login').send({
      email: 'voter0@example.com',
      password: 'correct horse battery staple',
    });
    const auth = { Authorization: `Bearer ${login.body.tokens.accessToken}` };
    await rate(auth, routeId, { score: 5 });

    // (5 + 10 * 4) / 5 = 9
    expect(await publicSummary(routeId)).toEqual({ average: 9, votes: 5 });
  });

  it('appears on every route of the public list', async () => {
    const ada = await signUp('ada');
    const rated = await publicRoute(ada.auth);
    const unrated = await publicRoute(ada.auth);
    await voteAll(rated, [6, 6, 6, 6, 6]);

    const response = await request(app).get('/public/routes');

    const byId = new Map(
      (
        response.body.routes as {
          id: string;
          rating: { average: number | null; votes: number };
        }[]
      ).map((route) => [route.id, route.rating]),
    );
    expect(byId.get(rated)).toEqual({ average: 6, votes: 5 });
    expect(byId.get(unrated)).toEqual({ average: null, votes: 0 });
  });

  it('keeps routes apart', async () => {
    const ada = await signUp('ada');
    const first = await publicRoute(ada.auth);
    const second = await publicRoute(ada.auth);
    await voteAll(first, [10, 10, 10, 10, 10]);

    expect(await publicSummary(second)).toEqual({ average: null, votes: 0 });
  });

  it('never says who voted what', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);
    await voteAll(routeId, [1, 2, 3, 4, 5]);

    const detail = await request(app).get(`/public/routes/${routeId}`);
    const list = await request(app).get('/public/routes');

    for (const body of [detail.body, list.body]) {
      const text = JSON.stringify(body);
      expect(text).not.toContain('voter');
      expect(text).not.toContain('userId');
    }
  });
});

describe('my own vote', () => {
  it('requires a signed-in user and a joined route', async () => {
    const ada = await signUp('ada');
    const carol = await signUp('carol');
    const routeId = await publicRoute(ada.auth);

    const anonymous = await request(app).get(`/routes/${routeId}/rating`);
    const stranger = await myRating(carol.auth, routeId);

    expect(anonymous.status).toBe(401);
    expect(stranger.status).toBe(404);
  });

  it('says whether I can vote yet and what I gave', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await publicRoute(ada.auth);
    await join(bob.auth, routeId);

    const before = await myRating(bob.auth, routeId);
    await complete(bob.auth, routeId);
    const ready = await myRating(bob.auth, routeId);
    await rate(bob.auth, routeId, { score: 7 });
    const after = await myRating(bob.auth, routeId);

    expect(before.body).toMatchObject({ rating: null, canRate: false });
    expect(ready.body).toMatchObject({ rating: null, canRate: true });
    expect(after.body).toMatchObject({ rating: { score: 7 }, canRate: true });
  });

  it('does not show other people their vote', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);
    const bob = await finisher('bob', routeId);
    const carol = await finisher('carol', routeId);
    await rate(bob.auth, routeId, { score: 2 });

    const carolView = await myRating(carol.auth, routeId);

    expect(carolView.body.rating).toBeNull();
  });
});

describe('database rules', () => {
  it('refuses a score outside 1 to 10', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);
    const bob = await finisher('bob', routeId);

    for (const score of [0, 11, -1]) {
      await expect(
        db.routeRating.create({
          data: { routeId, userId: bob.userId, score },
        }),
      ).rejects.toThrow();
    }
  });

  it('refuses a second vote from the same person', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);
    const bob = await finisher('bob', routeId);
    await db.routeRating.create({
      data: { routeId, userId: bob.userId, score: 5 },
    });

    await expect(
      db.routeRating.create({
        data: { routeId, userId: bob.userId, score: 6 },
      }),
    ).rejects.toThrow();
  });

  it('deletes the votes with the account', async () => {
    const ada = await signUp('ada');
    const routeId = await publicRoute(ada.auth);
    const bob = await finisher('bob', routeId);
    await rate(bob.auth, routeId, { score: 5 });

    await db.user.delete({ where: { id: bob.userId } });

    expect(await db.routeRating.count()).toBe(0);
  });
});
