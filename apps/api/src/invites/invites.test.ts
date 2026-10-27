import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hashOpaqueToken } from '../auth/tokens.js';
import { createTestApp, createTestDb, resetDb } from '../test/helpers.js';

// Integration tests: they need the Postgres test database (see README).
const db = createTestDb();
const app = createTestApp(db);
const DAY_MS = 24 * 60 * 60 * 1000;

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

/** A route with three films, already shared (unlisted). */
async function sharedRoute(auth: Auth) {
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
    .send({ visibility: 'unlisted' });
  return routeId;
}

async function createInvite(auth: Auth, routeId: string, body: object = {}) {
  const response = await request(app)
    .post(`/routes/${routeId}/invites`)
    .set(auth)
    .send(body);
  return {
    response,
    id: response.body.invite?.id as string,
    token: response.body.invite?.token as string,
  };
}

const accept = (auth: Auth, token: string) =>
  request(app).post('/invites/accept').set(auth).send({ token });

const usesCount = async (inviteId: string) =>
  (await db.routeInvite.findUniqueOrThrow({ where: { id: inviteId } }))
    .usesCount;

describe('creating invitation links', () => {
  it('requires a signed-in user', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);

    const response = await request(app).post(`/routes/${routeId}/invites`);

    expect(response.status).toBe(401);
  });

  it('returns the token once and stores only its hash', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);

    const { response, id, token } = await createInvite(ada.auth, routeId);
    const stored = await db.routeInvite.findUniqueOrThrow({ where: { id } });
    const listed = await request(app)
      .get(`/routes/${routeId}/invites`)
      .set(ada.auth);

    expect(response.status).toBe(201);
    expect(token).toEqual(expect.any(String));
    expect(stored.tokenHash).toBe(hashOpaqueToken(token));
    expect(stored.tokenHash).not.toBe(token);
    expect(JSON.stringify(listed.body)).not.toContain(token);
  });

  it('defaults to unlimited uses and a 30 day expiry', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);

    const { response } = await createInvite(ada.auth, routeId);

    expect(response.body.invite).toMatchObject({
      maxUses: null,
      usesCount: 0,
      status: 'active',
    });
    const expiresIn =
      new Date(response.body.invite.expiresAt).getTime() - Date.now();
    expect(expiresIn).toBeGreaterThan(29.9 * DAY_MS);
    expect(expiresIn).toBeLessThan(30.1 * DAY_MS);
  });

  it('accepts a cap, a custom expiry, or no expiry at all', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);

    const capped = await createInvite(ada.auth, routeId, {
      maxUses: 5,
      expiresInDays: 7,
    });
    const forever = await createInvite(ada.auth, routeId, {
      expiresInDays: null,
    });

    expect(capped.response.body.invite.maxUses).toBe(5);
    expect(forever.response.body.invite.expiresAt).toBeNull();
  });

  it('validates the input', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);

    for (const body of [
      { maxUses: 0 },
      { maxUses: -3 },
      { maxUses: 1.5 },
      { expiresInDays: 0 },
      { expiresInDays: 400 },
    ]) {
      const { response } = await createInvite(ada.auth, routeId, body);
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('needs a shared route and an author', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const draft = await request(app)
      .post('/routes')
      .set(ada.auth)
      .send({ title: 'Draft' });
    const shared = await sharedRoute(ada.auth);

    const onDraft = await createInvite(ada.auth, draft.body.route.id);
    const asStranger = await createInvite(bob.auth, shared);

    expect(onDraft.response.status).toBe(409);
    expect(onDraft.response.body.error.code).toBe('route_not_shared');
    expect(asStranger.response.status).toBe(404);
  });
});

describe('listing and revoking links', () => {
  it('shows each link with its status and how often it was used', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const live = await createInvite(ada.auth, routeId);
    const full = await createInvite(ada.auth, routeId, { maxUses: 1 });
    const old = await createInvite(ada.auth, routeId);
    const revoked = await createInvite(ada.auth, routeId);
    await accept(bob.auth, full.token);
    await db.routeInvite.update({
      where: { id: old.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(app)
      .delete(`/routes/${routeId}/invites/${revoked.id}`)
      .set(ada.auth);

    const { body } = await request(app)
      .get(`/routes/${routeId}/invites`)
      .set(ada.auth);

    const statusOf = (id: string) =>
      body.invites.find((invite: { id: string }) => invite.id === id);
    expect(statusOf(live.id).status).toBe('active');
    expect(statusOf(full.id)).toMatchObject({
      status: 'exhausted',
      usesCount: 1,
    });
    expect(statusOf(old.id).status).toBe('expired');
    expect(statusOf(revoked.id).status).toBe('revoked');
  });

  it('only the author can list or revoke, and revoking is repeatable', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const { id } = await createInvite(ada.auth, routeId);
    const url = `/routes/${routeId}/invites/${id}`;

    const listAsStranger = await request(app)
      .get(`/routes/${routeId}/invites`)
      .set(bob.auth);
    const revokeAsStranger = await request(app).delete(url).set(bob.auth);
    const first = await request(app).delete(url).set(ada.auth);
    const second = await request(app).delete(url).set(ada.auth);

    expect(listAsStranger.status).toBe(404);
    expect(revokeAsStranger.status).toBe(404);
    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
  });
});

describe('POST /invites/accept', () => {
  it('requires a signed-in user and a known token', async () => {
    const bob = await signUp('bob');

    const anonymous = await request(app)
      .post('/invites/accept')
      .send({ token: 'x' });
    const unknown = await accept(bob.auth, 'never-issued');
    const empty = await request(app)
      .post('/invites/accept')
      .set(bob.auth)
      .send({});

    expect(anonymous.status).toBe(401);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('invite_not_found');
    expect(empty.status).toBe(400);
  });

  it('enrolls the traveler, uses a place and reveals no films', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const { id, token } = await createInvite(ada.auth, routeId);

    const response = await accept(bob.auth, token);

    expect(response.status).toBe(201);
    expect(response.body.enrollment.status).toBe('active');
    expect(response.body.route).toMatchObject({
      id: routeId,
      title: 'Horror for beginners',
      author: 'ada',
      stepCount: 3,
    });
    expect(response.body.route.steps).toBeUndefined();
    expect(await usesCount(id)).toBe(1);
    expect(
      await db.enrollment.count({ where: { routeId, inviteId: id } }),
    ).toBe(1);
  });

  it('lets several people join through the same link', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);
    const { id, token } = await createInvite(ada.auth, routeId);

    for (const name of ['bob', 'carol', 'dave']) {
      const traveler = await signUp(name);
      expect((await accept(traveler.auth, token)).status).toBe(201);
    }

    expect(await usesCount(id)).toBe(3);
  });

  it('is harmless to accept twice: no second place is used', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const { id, token } = await createInvite(ada.auth, routeId);

    const first = await accept(bob.auth, token);
    const second = await accept(bob.auth, token);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.enrollment.id).toBe(first.body.enrollment.id);
    expect(await usesCount(id)).toBe(1);
  });

  it('stops when the cap is reached', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);
    const { id, token } = await createInvite(ada.auth, routeId, { maxUses: 2 });
    const people = await Promise.all(['bob', 'carol', 'dave'].map(signUp));

    const statuses = [];
    for (const person of people) {
      statuses.push((await accept(person.auth, token)).status);
    }
    const lastBody = (await accept(people[2]!.auth, token)).body;

    expect(statuses).toEqual([201, 201, 410]);
    expect(lastBody.error.code).toBe('invite_exhausted');
    expect(await usesCount(id)).toBe(2);
  });

  it('gives the last place to exactly one of several simultaneous people', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);
    const { id, token } = await createInvite(ada.auth, routeId, { maxUses: 1 });
    const people = await Promise.all(
      ['bob', 'carol', 'dave', 'erin', 'frank'].map(signUp),
    );

    const responses = await Promise.all(
      people.map((person) => accept(person.auth, token)),
    );

    expect(responses.map((r) => r.status).sort()).toEqual([
      201, 410, 410, 410, 410,
    ]);
    expect(await usesCount(id)).toBe(1);
    expect(await db.enrollment.count({ where: { routeId } })).toBe(1);
  });

  it('does not fail a person who double-clicks a single-place link', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const { id, token } = await createInvite(ada.auth, routeId, { maxUses: 1 });

    const responses = await Promise.all([
      accept(bob.auth, token),
      accept(bob.auth, token),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await usesCount(id)).toBe(1);
    expect(await db.enrollment.count({ where: { routeId } })).toBe(1);
  });

  it('does not fail a person who double-clicks an uncapped link', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const { id, token } = await createInvite(ada.auth, routeId);

    const responses = await Promise.all([
      accept(bob.auth, token),
      accept(bob.auth, token),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await usesCount(id)).toBe(1);
    expect(await db.enrollment.count({ where: { routeId } })).toBe(1);
  });

  it('rejects revoked, expired and withdrawn links', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const revoked = await createInvite(ada.auth, routeId);
    const expired = await createInvite(ada.auth, routeId);
    const withdrawn = await createInvite(ada.auth, routeId);
    await request(app)
      .delete(`/routes/${routeId}/invites/${revoked.id}`)
      .set(ada.auth);
    await db.routeInvite.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const revokedResponse = await accept(bob.auth, revoked.token);
    const expiredResponse = await accept(bob.auth, expired.token);
    // The author stops sharing the route: every link to it stops working.
    await db.route.update({
      where: { id: routeId },
      data: { visibility: 'PRIVATE' },
    });
    const withdrawnResponse = await accept(bob.auth, withdrawn.token);

    expect(revokedResponse.status).toBe(410);
    expect(revokedResponse.body.error.code).toBe('invite_revoked');
    expect(expiredResponse.status).toBe(410);
    expect(expiredResponse.body.error.code).toBe('invite_expired');
    expect(withdrawnResponse.status).toBe(410);
    expect(withdrawnResponse.body.error.code).toBe('invite_unavailable');
    expect(await db.enrollment.count()).toBe(0);
  });

  it('does not let an author follow their own route', async () => {
    const ada = await signUp('ada');
    const routeId = await sharedRoute(ada.auth);
    const { id, token } = await createInvite(ada.auth, routeId);

    const response = await accept(ada.auth, token);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('cannot_join_own_route');
    expect(await usesCount(id)).toBe(0);
  });

  it('brings back someone who left, without using another place', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const { id, token } = await createInvite(ada.auth, routeId, { maxUses: 1 });
    const joined = await accept(bob.auth, token);
    await db.enrollment.update({
      where: { id: joined.body.enrollment.id },
      data: { status: 'ABANDONED' },
    });

    const back = await accept(bob.auth, token);

    expect(back.status).toBe(200);
    expect(back.body.enrollment.status).toBe('active');
    expect(await usesCount(id)).toBe(1);
  });

  it('locks the route structure once someone has joined', async () => {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const { token } = await createInvite(ada.auth, routeId);

    await accept(bob.auth, token);
    const addFilm = await request(app)
      .post(`/routes/${routeId}/steps`)
      .set(ada.auth)
      .send({ tmdbId: 4 });
    const detail = await request(app).get(`/routes/${routeId}`).set(ada.auth);

    expect(addFilm.status).toBe(409);
    expect(addFilm.body.error.code).toBe('route_locked');
    expect(detail.body.route.locked).toBe(true);
  });
});

describe('managing travelers', () => {
  async function routeWithTraveler() {
    const ada = await signUp('ada');
    const bob = await signUp('bob');
    const routeId = await sharedRoute(ada.auth);
    const invite = await createInvite(ada.auth, routeId, { maxUses: 5 });
    const joined = await accept(bob.auth, invite.token);
    return {
      ada,
      bob,
      routeId,
      invite,
      enrollmentId: joined.body.enrollment.id as string,
    };
  }

  it('lets the author see who joined, and nobody else', async () => {
    const { ada, bob, routeId } = await routeWithTraveler();

    const asAuthor = await request(app)
      .get(`/routes/${routeId}/travelers`)
      .set(ada.auth);
    const asTraveler = await request(app)
      .get(`/routes/${routeId}/travelers`)
      .set(bob.auth);

    expect(asAuthor.body.travelers).toHaveLength(1);
    expect(asAuthor.body.travelers[0]).toMatchObject({
      username: 'bob',
      status: 'active',
    });
    expect(asTraveler.status).toBe(404);
  });

  it('removes a traveler for good, who cannot rejoin with the same link', async () => {
    const { ada, bob, routeId, invite, enrollmentId } =
      await routeWithTraveler();

    const removed = await request(app)
      .delete(`/routes/${routeId}/travelers/${enrollmentId}`)
      .set(ada.auth);
    const retry = await accept(bob.auth, invite.token);
    const listed = await request(app)
      .get(`/routes/${routeId}/travelers`)
      .set(ada.auth);

    expect(removed.status).toBe(204);
    expect(retry.status).toBe(403);
    expect(retry.body.error.code).toBe('removed_from_route');
    expect(listed.body.travelers[0].status).toBe('removed');
    // The place stays used: expelling someone does not reopen the link.
    expect(await usesCount(invite.id)).toBe(1);
  });

  it('unlocks the route when the only traveler is removed', async () => {
    const { ada, routeId, enrollmentId } = await routeWithTraveler();

    await request(app)
      .delete(`/routes/${routeId}/travelers/${enrollmentId}`)
      .set(ada.auth);
    const detail = await request(app).get(`/routes/${routeId}`).set(ada.auth);
    const addFilm = await request(app)
      .post(`/routes/${routeId}/steps`)
      .set(ada.auth)
      .send({ tmdbId: 4 });

    expect(detail.body.route.locked).toBe(false);
    expect(addFilm.status).toBe(201);
  });

  it('only the author can remove, and unknown travelers give a 404', async () => {
    const { ada, bob, routeId, enrollmentId } = await routeWithTraveler();

    const asTraveler = await request(app)
      .delete(`/routes/${routeId}/travelers/${enrollmentId}`)
      .set(bob.auth);
    const unknown = await request(app)
      .delete(`/routes/${routeId}/travelers/${ada.userId}`)
      .set(ada.auth);

    expect(asTraveler.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('traveler_not_found');
  });
});
