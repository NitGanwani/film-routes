import { RATING } from '@film-routes/shared';
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

async function signUpAdmin(username = 'root') {
  const admin = await signUp(username);
  await makeAdmin(db, admin.userId);
  return admin;
}

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

const join = (auth: Auth, routeId: string) =>
  request(app).post(`/public/routes/${routeId}/join`).set(auth);

const report = (auth: Auth, routeId: string, reason = 'spoiler') =>
  request(app).post(`/routes/${routeId}/reports`).set(auth).send({ reason });

const hide = (auth: Auth, routeId: string, reason = 'Spoils the ending') =>
  request(app).post(`/admin/routes/${routeId}/hide`).set(auth).send({ reason });

const unhide = (auth: Auth, routeId: string) =>
  request(app).post(`/admin/routes/${routeId}/unhide`).set(auth);

const queue = (auth: Auth, query = '') =>
  request(app).get(`/admin/reports${query}`).set(auth);

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

describe('the admin queue', () => {
  it('is empty when nobody has reported anything', async () => {
    const admin = await signUpAdmin();

    const response = await queue(admin.auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ routes: [], total: 0 });
  });

  it('groups reports by route: most reported first, then the one waiting longest', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const people = [];
    for (const name of ['person1', 'person2', 'person3']) {
      people.push(await signUp(name));
    }
    const first = await sharedRoute(ada.auth, 'public', 'Waited longest');
    const second = await sharedRoute(ada.auth, 'public', 'Most reported');
    const third = await sharedRoute(ada.auth, 'public', 'Newest');

    await report(people[0]!.auth, first, 'spam');
    await report(people[0]!.auth, second, 'spoiler');
    await report(people[1]!.auth, second, 'spoiler');
    await report(people[2]!.auth, second, 'offensive');
    await report(people[0]!.auth, third, 'other');

    const response = await queue(admin.auth);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(3);
    expect(
      response.body.routes.map((route: { title: string }) => route.title),
    ).toEqual(['Most reported', 'Waited longest', 'Newest']);
    expect(response.body.routes[0]).toMatchObject({
      routeId: second,
      author: 'ada',
      openReports: 3,
      byReason: { spoiler: 2, offensive: 1 },
      hidden: false,
    });
  });

  it('leaves out reports that were already dealt with', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const kept = await sharedRoute(ada.auth, 'public', 'Still open');
    const closed = await sharedRoute(ada.auth, 'public', 'Closed');
    await report(bob.auth, kept);
    await report(bob.auth, closed);
    await request(app)
      .post(`/admin/routes/${closed}/reports/dismiss`)
      .set(admin.auth);

    const response = await queue(admin.auth);

    expect(response.body.total).toBe(1);
    expect(response.body.routes).toHaveLength(1);
    expect(response.body.routes[0].routeId).toBe(kept);
  });

  it('counts only the open reports of a route, in total and by reason', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const carol = await signUp('carol');
    const routeId = await sharedRoute(ada.auth);
    const bad = await report(bob.auth, routeId, 'spam');
    await report(carol.auth, routeId, 'spoiler');
    // Bob's report was nonsense and gets closed; Carol's stays open.
    await request(app)
      .post(`/admin/reports/${bad.body.report.id}/dismiss`)
      .set(admin.auth);

    const response = await queue(admin.auth);

    expect(response.body.routes).toHaveLength(1);
    expect(response.body.routes[0]).toMatchObject({
      openReports: 1,
      byReason: { spoiler: 1 },
    });
    expect(response.body.routes[0].byReason).not.toHaveProperty('spam');
  });

  it('pages the groups and keeps the total', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const ids = [];
    for (const title of ['A', 'B', 'C']) {
      const routeId = await sharedRoute(ada.auth, 'public', title);
      await report(bob.auth, routeId);
      ids.push(routeId);
    }

    const one = await queue(admin.auth, '?pageSize=2&page=1');
    const two = await queue(admin.auth, '?pageSize=2&page=2');

    expect(one.body.total).toBe(3);
    expect(two.body.total).toBe(3);
    expect(one.body.routes).toHaveLength(2);
    expect(two.body.routes).toHaveLength(1);
    expect(
      [...one.body.routes, ...two.body.routes].map(
        (route: { routeId: string }) => route.routeId,
      ),
    ).toEqual(ids);
  });

  it('shows a route in full, notes included, with every report', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    await report(bob.auth, routeId, 'spoiler');

    const response = await request(app)
      .get(`/admin/routes/${routeId}`)
      .set(admin.auth);

    expect(response.status).toBe(200);
    expect(response.body.route.author).toBe('ada');
    expect(response.body.route.steps[0].noteAfter).toBe('secret after 1');
    expect(response.body.reports).toHaveLength(1);
    expect(response.body.reports[0]).toMatchObject({
      reporter: 'bob',
      reason: 'spoiler',
      status: 'open',
    });
  });

  it('answers 404 for a route that does not exist', async () => {
    const admin = await signUpAdmin();

    const response = await request(app)
      .get('/admin/routes/019a0000-0000-7000-8000-000000000000')
      .set(admin.auth);

    expect(response.status).toBe(404);
  });
});

describe('closing reports without hiding', () => {
  it('dismisses every open report of a route', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const carol = await signUp('carol');
    const routeId = await sharedRoute(ada.auth);
    await report(bob.auth, routeId);
    await report(carol.auth, routeId);

    const response = await request(app)
      .post(`/admin/routes/${routeId}/reports/dismiss`)
      .set(admin.auth);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ dismissed: 2 });
    const rows = await db.routeReport.findMany();
    expect(rows.every((row) => row.status === 'DISMISSED')).toBe(true);
    expect(rows.every((row) => row.resolvedAt && row.resolvedById)).toBe(true);
    // Dismissing does not touch the route.
    expect(
      (await db.route.findUniqueOrThrow({ where: { id: routeId } })).hiddenAt,
    ).toBeNull();
  });

  it('does not reopen or recount reports already closed', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    await report(bob.auth, routeId);
    const url = `/admin/routes/${routeId}/reports/dismiss`;
    await request(app).post(url).set(admin.auth);

    const again = await request(app).post(url).set(admin.auth);

    expect(again.body).toEqual({ dismissed: 0 });
  });

  it('answers 404 when the route does not exist', async () => {
    const admin = await signUpAdmin();

    const response = await request(app)
      .post(
        '/admin/routes/019a0000-0000-7000-8000-000000000000/reports/dismiss',
      )
      .set(admin.auth);

    expect(response.status).toBe(404);
  });

  it('dismisses a single report and leaves the others', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const carol = await signUp('carol');
    const routeId = await sharedRoute(ada.auth);
    const bad = await report(bob.auth, routeId);
    await report(carol.auth, routeId);

    const response = await request(app)
      .post(`/admin/reports/${bad.body.report.id}/dismiss`)
      .set(admin.auth);

    expect(response.status).toBe(204);
    const rows = await db.routeReport.findMany({
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((row) => row.status)).toEqual(['DISMISSED', 'OPEN']);
    expect(rows[0]).toMatchObject({ resolvedById: admin.userId });
  });

  it('refuses to dismiss twice, or something that does not exist', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const filed = await report(bob.auth, routeId);
    const url = `/admin/reports/${filed.body.report.id}/dismiss`;
    await request(app).post(url).set(admin.auth);

    const twice = await request(app).post(url).set(admin.auth);
    const missing = await request(app)
      .post('/admin/reports/019a0000-0000-7000-8000-000000000000/dismiss')
      .set(admin.auth);

    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe('report_already_resolved');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('report_not_found');
  });
});

describe('hiding and unhiding a route', () => {
  it('hides it with a reason and upholds the open reports', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const carol = await signUp('carol');
    const routeId = await sharedRoute(ada.auth);
    await report(bob.auth, routeId);
    await report(carol.auth, routeId);
    // One report was already dismissed earlier: it must stay dismissed.
    const dave = await signUp('dave');
    const old = await report(dave.auth, routeId);
    await db.routeReport.update({
      where: { id: old.body.report.id },
      data: { status: 'DISMISSED', resolvedAt: new Date() },
    });

    const response = await hide(admin.auth, routeId, '  Reveals the twist  ');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      reason: 'Reveals the twist',
      reportsUpheld: 2,
    });
    const route = await db.route.findUniqueOrThrow({ where: { id: routeId } });
    expect(route).toMatchObject({
      hiddenReason: 'Reveals the twist',
      hiddenById: admin.userId,
    });
    expect(route.hiddenAt).not.toBeNull();
    const statuses = (
      await db.routeReport.findMany({ orderBy: { createdAt: 'asc' } })
    ).map((row) => row.status);
    expect(statuses).toEqual(['UPHELD', 'UPHELD', 'DISMISSED']);
  });

  it('can hide a route nobody reported', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);

    const response = await hide(admin.auth, routeId);

    expect(response.status).toBe(200);
    expect(response.body.reportsUpheld).toBe(0);
  });

  it('needs a reason', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);

    const blank = await hide(admin.auth, routeId, '   ');
    const missing = await request(app)
      .post(`/admin/routes/${routeId}/hide`)
      .set(admin.auth)
      .send({});
    const long = await hide(admin.auth, routeId, 'x'.repeat(501));

    expect(blank.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(long.status).toBe(400);
    expect(
      (await db.route.findUniqueOrThrow({ where: { id: routeId } })).hiddenAt,
    ).toBeNull();
  });

  it('answers 404 for a route that does not exist', async () => {
    const admin = await signUpAdmin();

    const response = await hide(
      admin.auth,
      '019a0000-0000-7000-8000-000000000000',
    );

    expect(response.status).toBe(404);
  });

  it('refuses to hide a route that is already hidden', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);
    await hide(admin.auth, routeId, 'First reason');

    const response = await hide(admin.auth, routeId, 'Second reason');

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('already_hidden');
    expect(
      (await db.route.findUniqueOrThrow({ where: { id: routeId } }))
        .hiddenReason,
    ).toBe('First reason');
  });

  it('lets exactly one of two simultaneous hides win', async () => {
    const admin = await signUpAdmin();
    const other = await signUpAdmin('toor');
    const ada = await signUp('ada');

    for (let round = 0; round < 6; round += 1) {
      const routeId = await sharedRoute(ada.auth, 'public', `Route ${round}`);

      const [a, b] = await Promise.all([
        hide(admin.auth, routeId, 'Reason A'),
        hide(other.auth, routeId, 'Reason B'),
      ]);

      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const route = await db.route.findUniqueOrThrow({
        where: { id: routeId },
      });
      const winner = a.status === 200 ? 'Reason A' : 'Reason B';
      expect(route.hiddenReason).toBe(winner);
    }
  });

  it('lifts the hiding and keeps the reports as history', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    await report(bob.auth, routeId);
    await hide(admin.auth, routeId);

    const response = await unhide(admin.auth, routeId);

    expect(response.status).toBe(204);
    expect(
      await db.route.findUniqueOrThrow({ where: { id: routeId } }),
    ).toMatchObject({
      hiddenAt: null,
      hiddenReason: null,
      hiddenById: null,
    });
    expect((await db.routeReport.findFirstOrThrow()).status).toBe('UPHELD');
  });

  it('refuses to unhide a route that is not hidden, or does not exist', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);

    const visible = await unhide(admin.auth, routeId);
    const missing = await unhide(
      admin.auth,
      '019a0000-0000-7000-8000-000000000000',
    );

    expect(visible.status).toBe(409);
    expect(visible.body.error.code).toBe('not_hidden');
    expect(missing.status).toBe(404);
  });

  it('keeps the hiding when the admin who did it is deleted', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);
    await hide(admin.auth, routeId);

    await db.user.delete({ where: { id: admin.userId } });

    const route = await db.route.findUniqueOrThrow({ where: { id: routeId } });
    expect(route.hiddenAt).not.toBeNull();
    expect(route.hiddenById).toBeNull();
  });

  it('is enforced by the database: no half-hidden route', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);

    await expect(
      db.route.update({
        where: { id: routeId },
        data: { hiddenAt: new Date() },
      }),
    ).rejects.toThrow();
    await expect(
      db.route.update({
        where: { id: routeId },
        data: { hiddenAt: new Date(), hiddenReason: '   ' },
      }),
    ).rejects.toThrow();
    await expect(
      db.route.update({
        where: { id: routeId },
        data: { hiddenReason: 'orphan reason' },
      }),
    ).rejects.toThrow();
  });

  it('is enforced by the database: a report is resolved exactly when not open', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const filed = await report(bob.auth, routeId);
    const id = filed.body.report.id as string;

    await expect(
      db.routeReport.update({ where: { id }, data: { status: 'DISMISSED' } }),
    ).rejects.toThrow();
    await expect(
      db.routeReport.update({
        where: { id },
        data: { resolvedAt: new Date() },
      }),
    ).rejects.toThrow();
  });
});

describe('what a hidden route does to everyone', () => {
  it('disappears from the public list, in every ordering, and from its page', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const visible = await sharedRoute(ada.auth, 'public', 'Stays');
    const hidden = await sharedRoute(ada.auth, 'public', 'Goes');

    // Give both enough votes to be ranked in "top".
    for (let index = 0; index < RATING.minVotesToShowAverage; index += 1) {
      const voter = await signUp(`voter${index}`);
      for (const routeId of [visible, hidden]) {
        await join(voter.auth, routeId);
        await complete(voter.auth, routeId);
        await request(app)
          .put(`/routes/${routeId}/rating`)
          .set(voter.auth)
          .send({ score: 8 });
      }
    }
    for (const sort of ['new', 'popular', 'top']) {
      const before = await request(app).get(`/public/routes?sort=${sort}`);
      expect(before.body.total).toBe(2);
    }

    await hide(admin.auth, hidden);

    for (const sort of ['new', 'popular', 'top']) {
      const response = await request(app).get(`/public/routes?sort=${sort}`);
      expect(
        response.body.routes.map((route: { id: string }) => route.id),
        sort,
      ).toEqual([visible]);
      expect(response.body.total, sort).toBe(1);
    }
    const page = await request(app).get(`/public/routes/${hidden}`);
    expect(page.status).toBe(404);
  });

  it('cannot be joined from the public list, nor through an invitation link', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const carol = await signUp('carol');
    const routeId = await sharedRoute(ada.auth);
    const invite = await request(app)
      .post(`/routes/${routeId}/invites`)
      .set(ada.auth)
      .send({});
    await hide(admin.auth, routeId);

    const fromList = await join(bob.auth, routeId);
    const fromLink = await request(app)
      .post('/invites/accept')
      .set(carol.auth)
      .send({ token: invite.body.invite.token });

    expect(fromList.status).toBe(404);
    expect(fromLink.status).toBe(410);
    expect(fromLink.body.error.code).toBe('route_hidden');
    expect(await db.enrollment.count()).toBe(0);
  });

  it('stops people already inside, even through their old link, and the author cannot invite', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth, 'unlisted');
    const invite = await request(app)
      .post(`/routes/${routeId}/invites`)
      .set(ada.auth)
      .send({});
    const token = invite.body.invite.token as string;
    await request(app).post('/invites/accept').set(bob.auth).send({ token });
    await hide(admin.auth, routeId);

    const again = await request(app)
      .post('/invites/accept')
      .set(bob.auth)
      .send({ token });
    const newInvite = await request(app)
      .post(`/routes/${routeId}/invites`)
      .set(ada.auth)
      .send({});

    expect(again.status).toBe(410);
    expect(again.body.error.code).toBe('route_hidden');
    expect(newInvite.status).toBe(403);
    expect(newInvite.body.error.code).toBe('route_hidden');
  });

  it('stops the journey of travelers already inside, but lets them leave', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    await join(bob.auth, routeId);
    const journey = await request(app)
      .get(`/routes/${routeId}/journey`)
      .set(bob.auth);
    const [first, second] = journey.body.journey.steps as { id: string }[];
    await hide(admin.auth, routeId);

    const read = await request(app)
      .get(`/routes/${routeId}/journey`)
      .set(bob.auth);
    const start = await request(app)
      .post(`/routes/${routeId}/journey/steps/${first!.id}/start`)
      .set(bob.auth);
    const close = await request(app)
      .post(`/routes/${routeId}/journey/steps/${second!.id}/close`)
      .set(bob.auth)
      .send({ emotion: 'joy' });
    const leave = await request(app)
      .post(`/routes/${routeId}/journey/leave`)
      .set(bob.auth);

    for (const response of [read, start, close]) {
      expect(response.status).toBe(410);
      expect(response.body.error.code).toBe('route_hidden');
    }
    expect(leave.status).toBe(204);
    expect(await db.stepProgress.count()).toBe(0);
  });

  it("marks the route as hidden in the traveler's list, without leaking notes", async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    await join(bob.auth, routeId);
    await hide(admin.auth, routeId);

    const response = await request(app).get('/journeys').set(bob.auth);

    expect(response.status).toBe(200);
    expect(response.body.journeys[0].route).toMatchObject({
      id: routeId,
      hidden: true,
    });
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });

  it('blocks voting and reading your vote', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    await join(bob.auth, routeId);
    await complete(bob.auth, routeId);
    await hide(admin.auth, routeId);

    const vote = await request(app)
      .put(`/routes/${routeId}/rating`)
      .set(bob.auth)
      .send({ score: 9 });
    const mine = await request(app)
      .get(`/routes/${routeId}/rating`)
      .set(bob.auth);

    expect(vote.status).toBe(410);
    expect(mine.status).toBe(410);
    expect(await db.routeRating.count()).toBe(0);
  });

  it('gives travelers their route back, with their progress, when it is lifted', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    await join(bob.auth, routeId);
    const journey = await request(app)
      .get(`/routes/${routeId}/journey`)
      .set(bob.auth);
    const stepId = journey.body.journey.steps[0].id as string;
    await request(app)
      .post(`/routes/${routeId}/journey/steps/${stepId}/close`)
      .set(bob.auth)
      .send({ emotion: 'awe' });
    await hide(admin.auth, routeId);
    await unhide(admin.auth, routeId);

    const response = await request(app)
      .get(`/routes/${routeId}/journey`)
      .set(bob.auth);
    const listed = await request(app).get('/public/routes');

    expect(response.status).toBe(200);
    expect(response.body.journey.steps[0].myEmotion).toBe('awe');
    expect(listed.body.total).toBe(1);
  });
});

describe('what the author sees', () => {
  it('finds the route flagged, with the reason, in the detail and in the list', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);
    await hide(admin.auth, routeId, 'Reveals the ending in step 2');

    const detail = await request(app).get(`/routes/${routeId}`).set(ada.auth);
    const list = await request(app).get('/routes').set(ada.auth);

    expect(detail.body.route.moderation).toMatchObject({
      hidden: true,
      reason: 'Reveals the ending in step 2',
    });
    expect(detail.body.route.moderation.hiddenAt).toBeTruthy();
    expect(list.body.routes[0].hidden).toBe(true);
  });

  it('is not told who reported, or how many', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    await report(bob.auth, routeId);
    await hide(admin.auth, routeId);

    const detail = await request(app).get(`/routes/${routeId}`).set(ada.auth);

    const text = JSON.stringify(detail.body);
    expect(text).not.toContain('bob');
    expect(text).not.toContain('reporter');
  });

  it('shows an ordinary route as not hidden', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);

    const detail = await request(app).get(`/routes/${routeId}`).set(ada.auth);

    expect(detail.body.route.moderation).toEqual({
      hidden: false,
      hiddenAt: null,
      reason: null,
    });
  });

  it('cannot share it again, but can edit it, see travelers and take it private', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);
    await hide(admin.auth, routeId);

    const unlisted = await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'unlisted' });
    const publicAgain = await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'public' });
    const retitle = await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ title: 'Fixed title' });
    const goPrivate = await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'private' });

    for (const response of [unlisted, publicAgain]) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('route_hidden');
    }
    expect(retitle.status).toBe(200);
    expect(goPrivate.status).toBe(200);
    expect(goPrivate.body.route.visibility).toBe('private');
    // Still hidden: going private is not a way to lift it.
    expect(goPrivate.body.route.moderation.hidden).toBe(true);
  });

  it("can still read its travelers' journeys", async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const joined = await join(bob.auth, routeId);
    await hide(admin.auth, routeId);

    const travelers = await request(app)
      .get(`/routes/${routeId}/travelers`)
      .set(ada.auth);
    const journey = await request(app)
      .get(`/routes/${routeId}/travelers/${joined.body.enrollment.id}/journey`)
      .set(ada.auth);

    expect(travelers.status).toBe(200);
    expect(journey.status).toBe(200);
  });

  it('can share it again once an admin lifts the hiding', async () => {
    const admin = await signUpAdmin();
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);
    await hide(admin.auth, routeId);
    await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'private' });
    await unhide(admin.auth, routeId);

    const response = await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'public' });

    expect(response.status).toBe(200);
    expect(response.body.route.moderation.hidden).toBe(false);
  });
});
