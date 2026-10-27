import { ROUTE_LIMITS } from '@film-routes/shared';
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

const AUTHOR_EMOTIONS = ['joy', 'sadness', 'awe'] as const;

/** A shared route of three films with notes and the author's emotions. */
async function sharedRoute(auth: Auth) {
  const created = await request(app)
    .post('/routes')
    .set(auth)
    .send({ title: 'Horror for beginners' });
  const routeId = created.body.route.id as string;
  for (const [index, tmdbId] of [1, 2, 3].entries()) {
    await request(app)
      .post(`/routes/${routeId}/steps`)
      .set(auth)
      .send({
        tmdbId,
        noteBefore: `before-${index + 1}`,
        noteAfter: `after-${index + 1}`,
        authorEmotion: AUTHOR_EMOTIONS[index],
      });
  }
  await request(app)
    .patch(`/routes/${routeId}`)
    .set(auth)
    .send({ visibility: 'unlisted' });
  return routeId;
}

async function inviteToken(auth: Auth, routeId: string) {
  const response = await request(app)
    .post(`/routes/${routeId}/invites`)
    .set(auth)
    .send({});
  return response.body.invite.token as string;
}

/** Joins the route with a fresh link and returns the enrollment id. */
async function join(auth: Auth, authorAuth: Auth, routeId: string) {
  const token = await inviteToken(authorAuth, routeId);
  const response = await request(app)
    .post('/invites/accept')
    .set(auth)
    .send({ token });
  return response.body.enrollment.id as string;
}

const journeyOf = (auth: Auth, routeId: string) =>
  request(app).get(`/routes/${routeId}/journey`).set(auth);

const start = (auth: Auth, routeId: string, stepId: string) =>
  request(app)
    .post(`/routes/${routeId}/journey/steps/${stepId}/start`)
    .set(auth);

const close = (auth: Auth, routeId: string, stepId: string, body: object) =>
  request(app)
    .post(`/routes/${routeId}/journey/steps/${stepId}/close`)
    .set(auth)
    .send(body);

type JourneyStep = {
  id: string;
  position: number;
  state: string;
  recommendedNext: boolean;
  noteBefore: string | null;
  noteBeforeLocked: boolean;
  noteAfter: string | null;
  noteAfterLocked: boolean;
  authorEmotion: string | null;
  seenBefore: boolean;
  myEmotion: string | null;
  myComment: string | null;
};

async function stepsOf(auth: Auth, routeId: string) {
  const response = await journeyOf(auth, routeId);
  return response.body.journey.steps as JourneyStep[];
}

/** Ada's shared route with Bob already following it. */
async function followedRoute() {
  const ada = await signUp('ada');
  const bob = await signUp('bob');
  const routeId = await sharedRoute(ada.auth);
  const enrollmentId = await join(bob.auth, ada.auth, routeId);
  const steps = await stepsOf(bob.auth, routeId);
  return { ada, bob, routeId, enrollmentId, steps };
}

const statusOf = async (enrollmentId: string) =>
  (await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } }))
    .status;

describe('the traveler view', () => {
  it('requires a signed-in user', async () => {
    const { routeId } = await followedRoute();

    const response = await request(app).get(`/routes/${routeId}/journey`);

    expect(response.status).toBe(401);
  });

  it('shows every film from the start, in order', async () => {
    const { bob, routeId } = await followedRoute();

    const response = await journeyOf(bob.auth, routeId);

    expect(response.status).toBe(200);
    expect(response.body.journey.route).toMatchObject({
      title: 'Horror for beginners',
      author: 'ada',
    });
    expect(response.body.journey.enrollment).toMatchObject({
      status: 'active',
      closedSteps: 0,
      stepCount: 3,
    });
    const steps = response.body.journey.steps as {
      position: number;
      film: { title: string };
    }[];
    expect(steps.map((step) => step.position)).toEqual([1, 2, 3]);
    expect(steps.map((step) => step.film.title)).toEqual([
      'Película 1',
      'Película 2',
      'Película 3',
    ]);
  });

  it('only opens the note before of the film that is up next', async () => {
    const { bob, routeId } = await followedRoute();

    const steps = await stepsOf(bob.auth, routeId);

    expect(steps.map((step) => step.recommendedNext)).toEqual([
      true,
      false,
      false,
    ]);
    expect(steps.map((step) => step.noteBefore)).toEqual([
      'before-1',
      null,
      null,
    ]);
    expect(steps.map((step) => step.noteBeforeLocked)).toEqual([
      false,
      true,
      true,
    ]);
  });

  it('keeps every note after and the author emotion out of the response', async () => {
    const { bob, routeId } = await followedRoute();

    const response = await journeyOf(bob.auth, routeId);

    const text = JSON.stringify(response.body);
    expect(text).not.toContain('after-');
    expect(text).not.toContain('before-2');
    expect(text).not.toContain('before-3');
    for (const step of response.body.journey.steps as JourneyStep[]) {
      expect(step.authorEmotion).toBeNull();
      expect(step.noteAfterLocked).toBe(true);
    }
  });

  it('is only available to people who joined', async () => {
    const { ada, routeId } = await followedRoute();
    const carol = await signUp('carol');

    const stranger = await journeyOf(carol.auth, routeId);
    // The author is not a traveler of their own route.
    const author = await journeyOf(ada.auth, routeId);

    expect(stranger.status).toBe(404);
    expect(stranger.body.error.code).toBe('route_not_found');
    expect(author.status).toBe(404);
  });

  it('rejects a malformed route id', async () => {
    const { bob } = await followedRoute();

    const response = await request(app)
      .get('/routes/not-a-uuid/journey')
      .set(bob.auth);

    expect(response.status).toBe(400);
  });
});

describe('starting a film', () => {
  it('unlocks its note before, even out of order', async () => {
    const { bob, routeId, steps } = await followedRoute();

    const response = await start(bob.auth, routeId, steps[2]!.id);
    const after = response.body.journey.steps as JourneyStep[];

    expect(response.status).toBe(200);
    expect(after[2]).toMatchObject({
      state: 'started',
      noteBefore: 'before-3',
      noteBeforeLocked: false,
    });
    // The recommendation still points at the first film.
    expect(after[0]!.recommendedNext).toBe(true);
    expect(after[1]!.noteBefore).toBeNull();
  });

  it('can be repeated without moving the start time', async () => {
    const { bob, enrollmentId, routeId, steps } = await followedRoute();

    await start(bob.auth, routeId, steps[0]!.id);
    const first = await db.stepProgress.findFirstOrThrow({
      where: { enrollmentId },
    });
    const again = await start(bob.auth, routeId, steps[0]!.id);
    const second = await db.stepProgress.findFirstOrThrow({
      where: { enrollmentId },
    });

    expect(again.status).toBe(200);
    expect(second.startedAt).toEqual(first.startedAt);
    expect(await db.stepProgress.count({ where: { enrollmentId } })).toBe(1);
  });

  it('refuses a step of another route', async () => {
    const { ada, bob, routeId } = await followedRoute();
    const otherRoute = await sharedRoute(ada.auth);
    const foreign = await stepsOf(
      await (async () => {
        const dan = await signUp('dan');
        await join(dan.auth, ada.auth, otherRoute);
        return dan.auth;
      })(),
      otherRoute,
    );

    const response = await start(bob.auth, routeId, foreign[0]!.id);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('step_not_found');
  });

  it('cannot touch the progress of someone who did not join', async () => {
    const { routeId, steps } = await followedRoute();
    const carol = await signUp('carol');

    const response = await start(carol.auth, routeId, steps[0]!.id);

    expect(response.status).toBe(404);
  });
});

describe('closing a film', () => {
  it('needs an emotion, even for a film already seen', async () => {
    const { bob, enrollmentId, routeId, steps } = await followedRoute();

    for (const body of [
      {},
      { seenBefore: true },
      { comment: 'loved it' },
      { emotion: 'angry' },
      { emotion: null },
    ]) {
      const response = await close(bob.auth, routeId, steps[0]!.id, body);
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    expect(await db.stepProgress.count({ where: { enrollmentId } })).toBe(0);
  });

  it('limits the comment to 280 characters', async () => {
    const { bob, routeId, steps } = await followedRoute();

    const tooLong = await close(bob.auth, routeId, steps[0]!.id, {
      emotion: 'joy',
      comment: 'x'.repeat(ROUTE_LIMITS.commentMaxLength + 1),
    });
    const justRight = await close(bob.auth, routeId, steps[0]!.id, {
      emotion: 'joy',
      comment: 'x'.repeat(ROUTE_LIMITS.commentMaxLength),
    });

    expect(tooLong.status).toBe(400);
    expect(justRight.status).toBe(200);
  });

  it('unlocks the note after and the author emotion of that film only', async () => {
    const { bob, routeId, steps } = await followedRoute();

    const response = await close(bob.auth, routeId, steps[0]!.id, {
      emotion: 'tension',
      comment: 'I held my breath',
    });
    const after = response.body.journey.steps as JourneyStep[];

    expect(response.status).toBe(200);
    expect(after[0]).toMatchObject({
      state: 'closed',
      noteAfter: 'after-1',
      noteAfterLocked: false,
      authorEmotion: 'joy',
      myEmotion: 'tension',
      myComment: 'I held my breath',
      seenBefore: false,
    });
    expect(after[1]!.noteAfter).toBeNull();
    expect(after[1]!.authorEmotion).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain('after-2');
  });

  it('moves the recommendation to the next film', async () => {
    const { bob, routeId, steps } = await followedRoute();

    const response = await close(bob.auth, routeId, steps[0]!.id, {
      emotion: 'joy',
    });
    const after = response.body.journey.steps as JourneyStep[];

    expect(after.map((step) => step.recommendedNext)).toEqual([
      false,
      true,
      false,
    ]);
    expect(after[1]!.noteBefore).toBe('before-2');
    expect(response.body.journey.enrollment.closedSteps).toBe(1);
  });

  it('records a film seen before and still unlocks its notes', async () => {
    const { bob, routeId, steps } = await followedRoute();

    const response = await close(bob.auth, routeId, steps[1]!.id, {
      emotion: 'awe',
      seenBefore: true,
    });
    const after = response.body.journey.steps as JourneyStep[];

    expect(response.status).toBe(200);
    expect(after[1]).toMatchObject({
      state: 'closed',
      seenBefore: true,
      noteAfter: 'after-2',
      authorEmotion: 'sadness',
    });
  });

  it('does not require starting the film first', async () => {
    const { bob, enrollmentId, routeId, steps } = await followedRoute();

    await close(bob.auth, routeId, steps[0]!.id, { emotion: 'joy' });

    const row = await db.stepProgress.findFirstOrThrow({
      where: { enrollmentId },
    });
    expect(row.startedAt).toBeNull();
    expect(row.watchedAt).not.toBeNull();
  });

  it('keeps the start time of a film that was started first', async () => {
    const { bob, enrollmentId, routeId, steps } = await followedRoute();

    await start(bob.auth, routeId, steps[0]!.id);
    await close(bob.auth, routeId, steps[0]!.id, { emotion: 'joy' });

    const row = await db.stepProgress.findFirstOrThrow({
      where: { enrollmentId },
    });
    expect(row.startedAt).not.toBeNull();
    expect(row.emotion).toBe('JOY');
  });

  it('is final: a closed film cannot be closed or started again', async () => {
    const { bob, routeId, steps } = await followedRoute();
    await close(bob.auth, routeId, steps[0]!.id, { emotion: 'joy' });

    const closeAgain = await close(bob.auth, routeId, steps[0]!.id, {
      emotion: 'fear',
    });
    const startAgain = await start(bob.auth, routeId, steps[0]!.id);

    expect(closeAgain.status).toBe(409);
    expect(closeAgain.body.error.code).toBe('step_already_closed');
    expect(startAgain.status).toBe(409);
    expect((await stepsOf(bob.auth, routeId))[0]!.myEmotion).toBe('joy');
  });

  it('keeps each traveler progress separate', async () => {
    const { ada, bob, routeId, steps } = await followedRoute();
    const carol = await signUp('carol');
    await join(carol.auth, ada.auth, routeId);

    await close(bob.auth, routeId, steps[0]!.id, { emotion: 'joy' });
    const carolSteps = await stepsOf(carol.auth, routeId);

    expect(carolSteps[0]).toMatchObject({
      state: 'pending',
      myEmotion: null,
      noteAfter: null,
    });
  });
});

describe('completing a route', () => {
  it('completes it when the last film is closed, in any order', async () => {
    const { bob, enrollmentId, routeId, steps } = await followedRoute();

    await close(bob.auth, routeId, steps[2]!.id, { emotion: 'joy' });
    await close(bob.auth, routeId, steps[0]!.id, { emotion: 'awe' });
    expect(await statusOf(enrollmentId)).toBe('ACTIVE');

    const last = await close(bob.auth, routeId, steps[1]!.id, {
      emotion: 'sadness',
    });

    expect(await statusOf(enrollmentId)).toBe('COMPLETED');
    expect(last.body.journey.enrollment).toMatchObject({
      status: 'completed',
      closedSteps: 3,
      stepCount: 3,
    });
    expect(last.body.journey.enrollment.completedAt).not.toBeNull();
    const after = last.body.journey.steps as JourneyStep[];
    expect(after.map((step) => step.noteAfter)).toEqual([
      'after-1',
      'after-2',
      'after-3',
    ]);
    expect(after.some((step) => step.recommendedNext)).toBe(false);
  });

  it('completes exactly once when the last two films close together', async () => {
    // Repeated: a missing lock only shows up some of the time.
    for (let round = 0; round < 8; round += 1) {
      await resetDb(db);
      const { bob, enrollmentId, routeId, steps } = await followedRoute();
      await close(bob.auth, routeId, steps[0]!.id, { emotion: 'joy' });

      const [one, two] = await Promise.all([
        close(bob.auth, routeId, steps[1]!.id, { emotion: 'awe' }),
        close(bob.auth, routeId, steps[2]!.id, { emotion: 'fear' }),
      ]);

      expect([one.status, two.status], `round ${round}`).toEqual([200, 200]);
      expect(await statusOf(enrollmentId), `round ${round}`).toBe('COMPLETED');
    }
  });

  it('answers a double tap on the same film with one success', async () => {
    for (let round = 0; round < 8; round += 1) {
      await resetDb(db);
      const { bob, enrollmentId, routeId, steps } = await followedRoute();

      const results = await Promise.all([
        close(bob.auth, routeId, steps[0]!.id, { emotion: 'joy' }),
        close(bob.auth, routeId, steps[0]!.id, { emotion: 'fear' }),
      ]);

      expect(
        results.map((result) => result.status).sort(),
        `round ${round}`,
      ).toEqual([200, 409]);
      expect(await db.stepProgress.count({ where: { enrollmentId } })).toBe(1);
    }
  });
});

describe('leaving a route', () => {
  it('keeps the progress and blocks changes until they return', async () => {
    const { ada, bob, enrollmentId, routeId, steps } = await followedRoute();
    await close(bob.auth, routeId, steps[0]!.id, { emotion: 'joy' });

    const left = await request(app)
      .post(`/routes/${routeId}/journey/leave`)
      .set(bob.auth);
    const startWhileAway = await start(bob.auth, routeId, steps[1]!.id);
    const closeWhileAway = await close(bob.auth, routeId, steps[1]!.id, {
      emotion: 'awe',
    });
    const stillVisible = await journeyOf(bob.auth, routeId);

    expect(left.status).toBe(204);
    expect(await statusOf(enrollmentId)).toBe('ABANDONED');
    expect(startWhileAway.status).toBe(409);
    expect(startWhileAway.body.error.code).toBe('not_following');
    expect(closeWhileAway.status).toBe(409);
    expect(stillVisible.status).toBe(200);

    // Using the link again brings them back to where they were.
    await join(bob.auth, ada.auth, routeId);
    const back = await stepsOf(bob.auth, routeId);
    expect(await statusOf(enrollmentId)).toBe('ACTIVE');
    expect(back[0]!.myEmotion).toBe('joy');
  });

  it('cannot leave a completed route', async () => {
    const { bob, enrollmentId, routeId, steps } = await followedRoute();
    for (const step of steps) {
      await close(bob.auth, routeId, step.id, { emotion: 'joy' });
    }

    const response = await request(app)
      .post(`/routes/${routeId}/journey/leave`)
      .set(bob.auth);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('route_completed');
    expect(await statusOf(enrollmentId)).toBe('COMPLETED');
  });

  it('is harmless to repeat', async () => {
    const { bob, routeId } = await followedRoute();
    const leave = () =>
      request(app).post(`/routes/${routeId}/journey/leave`).set(bob.auth);

    await leave();
    const again = await leave();

    expect(again.status).toBe(204);
  });
});

describe('what the author can still do', () => {
  it('unpublishing leaves those already inside free to finish', async () => {
    const { ada, bob, enrollmentId, routeId, steps } = await followedRoute();

    const unpublished = await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'private' });
    for (const step of steps) {
      await close(bob.auth, routeId, step.id, { emotion: 'joy' });
    }

    expect(unpublished.status).toBe(200);
    expect(await statusOf(enrollmentId)).toBe('COMPLETED');
  });

  it('removing a traveler shuts them out of the route', async () => {
    const { ada, bob, enrollmentId, routeId, steps } = await followedRoute();

    await request(app)
      .delete(`/routes/${routeId}/travelers/${enrollmentId}`)
      .set(ada.auth);
    const view = await journeyOf(bob.auth, routeId);
    const started = await start(bob.auth, routeId, steps[0]!.id);
    const closed = await close(bob.auth, routeId, steps[0]!.id, {
      emotion: 'joy',
    });

    for (const response of [view, started, closed]) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('removed_from_route');
    }
    expect(await db.stepProgress.count({ where: { enrollmentId } })).toBe(0);
  });

  it('shows the author their emotion next to the traveler one', async () => {
    const { ada, bob, enrollmentId, routeId, steps } = await followedRoute();
    await close(bob.auth, routeId, steps[0]!.id, {
      emotion: 'joy',
      comment: 'same as you',
    });
    await close(bob.auth, routeId, steps[1]!.id, {
      emotion: 'fear',
      seenBefore: true,
    });

    const response = await request(app)
      .get(`/routes/${routeId}/travelers/${enrollmentId}/journey`)
      .set(ada.auth);

    expect(response.status).toBe(200);
    expect(response.body.traveler).toMatchObject({
      username: 'bob',
      status: 'active',
      closedSteps: 2,
      stepCount: 3,
    });
    expect(response.body.steps).toMatchObject([
      {
        position: 1,
        authorEmotion: 'joy',
        travelerEmotion: 'joy',
        travelerComment: 'same as you',
        sameEmotion: true,
      },
      {
        position: 2,
        authorEmotion: 'sadness',
        travelerEmotion: 'fear',
        seenBefore: true,
        sameEmotion: false,
      },
      {
        position: 3,
        authorEmotion: 'awe',
        travelerEmotion: null,
        state: 'pending',
        sameEmotion: null,
      },
    ]);
  });

  it('is private to the author of that route', async () => {
    const { bob, enrollmentId, routeId } = await followedRoute();
    const carol = await signUp('carol');
    const path = `/routes/${routeId}/travelers/${enrollmentId}/journey`;

    const traveler = await request(app).get(path).set(bob.auth);
    const stranger = await request(app).get(path).set(carol.auth);
    const anonymous = await request(app).get(path);

    expect(traveler.status).toBe(404);
    expect(stranger.status).toBe(404);
    expect(anonymous.status).toBe(401);
  });

  it('answers 404 for a traveler that does not belong to the route', async () => {
    const { ada, routeId } = await followedRoute();
    const otherRoute = await sharedRoute(ada.auth);
    const dan = await signUp('dan');
    const foreignEnrollment = await join(dan.auth, ada.auth, otherRoute);

    const response = await request(app)
      .get(`/routes/${routeId}/travelers/${foreignEnrollment}/journey`)
      .set(ada.auth);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('traveler_not_found');
  });

  it('shows the progress of each traveler in the list', async () => {
    const { ada, bob, routeId, steps } = await followedRoute();
    await close(bob.auth, routeId, steps[0]!.id, { emotion: 'joy' });

    const response = await request(app)
      .get(`/routes/${routeId}/travelers`)
      .set(ada.auth);

    expect(response.body.travelers).toMatchObject([
      { username: 'bob', closedSteps: 1, stepCount: 3 },
    ]);
  });
});

describe('my routes', () => {
  it('lists the routes I follow with how far along I am', async () => {
    const { ada, bob, routeId, steps } = await followedRoute();
    const second = await sharedRoute(ada.auth);
    await join(bob.auth, ada.auth, second);
    await close(bob.auth, routeId, steps[0]!.id, { emotion: 'joy' });

    const response = await request(app).get('/journeys').set(bob.auth);

    expect(response.status).toBe(200);
    const journeys = response.body.journeys as {
      route: { id: string; author: string; stepCount: number };
      closedSteps: number;
      status: string;
    }[];
    expect(journeys).toHaveLength(2);
    const first = journeys.find((journey) => journey.route.id === routeId);
    expect(first).toMatchObject({
      closedSteps: 1,
      status: 'active',
      route: { author: 'ada', stepCount: 3 },
    });
  });

  it('does not list routes from which I was removed, or other people routes', async () => {
    const { ada, bob, enrollmentId, routeId } = await followedRoute();
    const carol = await signUp('carol');
    await join(carol.auth, ada.auth, routeId);
    await request(app)
      .delete(`/routes/${routeId}/travelers/${enrollmentId}`)
      .set(ada.auth);

    const bobList = await request(app).get('/journeys').set(bob.auth);
    const carolList = await request(app).get('/journeys').set(carol.auth);

    expect(bobList.body.journeys).toEqual([]);
    expect(carolList.body.journeys).toHaveLength(1);
  });
});

describe('database rules', () => {
  it('refuses an emotion on a film that has no watch date', async () => {
    const { enrollmentId, steps } = await followedRoute();

    await expect(
      db.stepProgress.create({
        data: { enrollmentId, stepId: steps[0]!.id, emotion: 'JOY' },
      }),
    ).rejects.toThrow();
  });

  it('refuses a comment without an emotion', async () => {
    const { enrollmentId, steps } = await followedRoute();

    await expect(
      db.stepProgress.create({
        data: {
          enrollmentId,
          stepId: steps[0]!.id,
          startedAt: new Date(),
          comment: 'alone',
        },
      }),
    ).rejects.toThrow();
  });
});
