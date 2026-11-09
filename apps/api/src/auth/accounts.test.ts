import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryMailer,
  createTestApp,
  createTestDb,
  markVerified,
  resetDb,
  tokenFrom,
} from '../test/helpers.js';
import { EMAIL_TOKEN_TTL_MS, RESEND_COOLDOWN_MS } from './emailTokens.js';

// Integration tests: they need the Postgres test database (see README).
const db = createTestDb();
const mailer = createMemoryMailer();
const app = createTestApp(db, { mailer });

const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'a completely different one';

beforeEach(async () => {
  await resetDb(db);
  mailer.outbox.length = 0;
});
afterAll(async () => {
  await resetDb(db);
  await db.$disconnect();
});

/** A new account, still unverified: the way a real person starts. */
async function register(username: string, extra: object = {}) {
  const response = await request(app)
    .post('/auth/register')
    .send({
      username,
      email: `${username}@example.com`,
      password: PASSWORD,
      ...extra,
    });
  return {
    response,
    email: `${username}@example.com`,
    userId: response.body.user?.id as string,
    auth: { Authorization: `Bearer ${response.body.tokens?.accessToken}` },
    refreshToken: response.body.tokens?.refreshToken as string,
  };
}

const lastEmail = () => {
  const message = mailer.outbox.at(-1);
  if (!message) throw new Error('No email was sent');
  return message;
};

const verify = (token: string) =>
  request(app).post('/auth/verify-email').send({ token });
const forgot = (email: string) =>
  request(app).post('/auth/password/forgot').send({ email });
const reset = (token: string, password: string) =>
  request(app).post('/auth/password/reset').send({ token, password });
const login = (email: string, password: string) =>
  request(app).post('/auth/login').send({ email, password });
const me = (auth: { Authorization: string }) =>
  request(app).get('/auth/me').set(auth);

const longAgo = () => new Date(Date.now() - 2 * RESEND_COOLDOWN_MS);
const inThePast = () => new Date(Date.now() - 1000);

describe('confirming the email address', () => {
  it('sends one email with a link when someone registers', async () => {
    const ada = await register('ada');

    expect(ada.response.status).toBe(201);
    expect(ada.response.body.user.emailVerified).toBe(false);
    expect(mailer.outbox).toHaveLength(1);
    expect(lastEmail().to).toBe('ada@example.com');
    expect(lastEmail().text).toContain(
      'http://localhost:5173/verify-email?token=',
    );
  });

  it('writes to them in their language', async () => {
    await register('ada');
    const spanish = lastEmail();
    await register('eve', { locale: 'en' });
    const english = lastEmail();

    expect(spanish.subject).toContain('Confirma tu correo');
    expect(english.subject).toContain('Confirm your email');
  });

  it('stores only a hash of the token', async () => {
    await register('ada');
    const token = tokenFrom(lastEmail());

    const stored = await db.userToken.findFirstOrThrow();

    expect(stored.purpose).toBe('VERIFY_EMAIL');
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).not.toContain(token);
  });

  it('confirms the address when the link is opened', async () => {
    const ada = await register('ada');

    const response = await verify(tokenFrom(lastEmail()));

    expect(response.status).toBe(204);
    expect((await me(ada.auth)).body.user.emailVerified).toBe(true);
  });

  it('works only once', async () => {
    await register('ada');
    const token = tokenFrom(lastEmail());

    const first = await verify(token);
    const second = await verify(token);

    expect(first.status).toBe(204);
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('invalid_token');
  });

  it('works only once even when opened twice at the same instant', async () => {
    for (let round = 0; round < 6; round += 1) {
      await resetDb(db);
      mailer.outbox.length = 0;
      await register('ada');
      const token = tokenFrom(lastEmail());

      const results = await Promise.all([verify(token), verify(token)]);

      expect(
        results.map((result) => result.status).sort(),
        `round ${round}`,
      ).toEqual([204, 400]);
    }
  });

  it('stops working after 24 hours', async () => {
    const ada = await register('ada');
    await db.userToken.updateMany({ data: { expiresAt: inThePast() } });

    const response = await verify(tokenFrom(lastEmail()));

    expect(response.status).toBe(400);
    expect((await me(ada.auth)).body.user.emailVerified).toBe(false);
    expect(EMAIL_TOKEN_TTL_MS.VERIFY_EMAIL).toBe(24 * 60 * 60 * 1000);
  });

  it('rejects an invented link, and one made for another purpose', async () => {
    await register('ada');
    await forgot('ada@example.com');
    const resetToken = tokenFrom(lastEmail());

    for (const token of ['not-a-real-token', 'x'.repeat(43), resetToken]) {
      const response = await verify(token);
      expect(response.status, token).toBe(400);
    }
  });

  it('can be asked for again, but not in a flood', async () => {
    const ada = await register('ada');

    const tooSoon = await request(app)
      .post('/auth/verify-email/resend')
      .set(ada.auth);
    await db.userToken.updateMany({ data: { createdAt: longAgo() } });
    const old = tokenFrom(lastEmail());
    const again = await request(app)
      .post('/auth/verify-email/resend')
      .set(ada.auth);

    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.error.code).toBe('too_soon');
    expect(again.status).toBe(204);
    expect(mailer.outbox).toHaveLength(2);
    // Only the latest email works.
    expect((await verify(old)).status).toBe(400);
    expect((await verify(tokenFrom(lastEmail()))).status).toBe(204);
  });

  it('cannot be asked for by someone signed out, or already confirmed', async () => {
    const ada = await register('ada');
    await verify(tokenFrom(lastEmail()));
    await db.userToken.updateMany({ data: { createdAt: longAgo() } });

    const anonymous = await request(app).post('/auth/verify-email/resend');
    const confirmed = await request(app)
      .post('/auth/verify-email/resend')
      .set(ada.auth);

    expect(anonymous.status).toBe(401);
    expect(confirmed.status).toBe(409);
    expect(confirmed.body.error.code).toBe('already_verified');
  });

  it('does not stop registration when the email cannot be sent', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = createTestApp(db, {
      mailer: {
        send: async () => {
          throw new Error('provider down');
        },
      },
    });
    const throwing = createTestApp(db, {
      mailer: {
        send: () => {
          throw new Error('provider down');
        },
      },
    });

    for (const [name, target] of [
      ['ada', failing],
      ['bob', throwing],
    ] as const) {
      const response = await request(target)
        .post('/auth/register')
        .send({
          username: name,
          email: `${name}@example.com`,
          password: PASSWORD,
        });
      expect(response.status, name).toBe(201);
    }
    quiet.mockRestore();
  });
});

describe('what an unconfirmed address cannot do', () => {
  /** A private draft of three films, owned by someone unconfirmed. */
  async function draftOf(auth: { Authorization: string }) {
    const created = await request(app)
      .post('/routes')
      .set(auth)
      .send({ title: 'Draft' });
    const routeId = created.body.route.id as string;
    for (const tmdbId of [1, 2, 3]) {
      await request(app)
        .post(`/routes/${routeId}/steps`)
        .set(auth)
        .send({ tmdbId });
    }
    return routeId;
  }

  it('can still browse, write drafts and edit them', async () => {
    const ada = await register('ada');

    const routeId = await draftOf(ada.auth);
    const renamed = await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ title: 'Better title' });
    const list = await request(app).get('/public/routes');

    expect(renamed.status).toBe(200);
    expect(list.status).toBe(200);
  });

  it('cannot share a route', async () => {
    const ada = await register('ada');
    const routeId = await draftOf(ada.auth);

    for (const visibility of ['unlisted', 'public']) {
      const response = await request(app)
        .patch(`/routes/${routeId}`)
        .set(ada.auth)
        .send({ visibility });
      expect(response.status, visibility).toBe(403);
      expect(response.body.error.code).toBe('email_not_verified');
    }
    const route = await db.route.findUniqueOrThrow({ where: { id: routeId } });
    expect(route.visibility).toBe('PRIVATE');
  });

  it('can always take a route back to private', async () => {
    const ada = await register('ada');
    const routeId = await draftOf(ada.auth);
    await db.route.update({
      where: { id: routeId },
      data: { visibility: 'PUBLIC' },
    });

    const response = await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'private' });

    expect(response.status).toBe(200);
  });

  it('cannot create invitation links', async () => {
    const ada = await register('ada');
    const routeId = await draftOf(ada.auth);
    await db.route.update({
      where: { id: routeId },
      data: { visibility: 'UNLISTED' },
    });

    const response = await request(app)
      .post(`/routes/${routeId}/invites`)
      .set(ada.auth)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('email_not_verified');
  });

  it('cannot rate a route', async () => {
    const ada = await register('ada');

    const response = await request(app)
      .put('/routes/01a19db3-e7f0-7320-a66c-03fffe179351/rating')
      .set(ada.auth)
      .send({ score: 8 });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('email_not_verified');
  });

  it('can do all of it once the address is confirmed', async () => {
    const ada = await register('ada');
    const routeId = await draftOf(ada.auth);
    await verify(tokenFrom(lastEmail()));

    const shared = await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'unlisted' });
    const invite = await request(app)
      .post(`/routes/${routeId}/invites`)
      .set(ada.auth)
      .send({});

    expect(shared.status).toBe(200);
    expect(invite.status).toBe(201);
  });
});

describe('forgetting the password', () => {
  it('answers the same whether or not the address has an account', async () => {
    await register('ada');
    mailer.outbox.length = 0;

    const known = await forgot('ada@example.com');
    const unknown = await forgot('nobody@example.com');

    expect(known.status).toBe(204);
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    // Only the real address got an email.
    expect(mailer.outbox).toHaveLength(1);
    expect(lastEmail().to).toBe('ada@example.com');
    expect(lastEmail().text).toContain('/reset-password?token=');
  });

  it('does not send a second email within a minute', async () => {
    await register('ada');
    mailer.outbox.length = 0;

    await forgot('ada@example.com');
    const again = await forgot('ada@example.com');

    expect(again.status).toBe(204);
    expect(mailer.outbox).toHaveLength(1);
  });

  it('sets the new password and drops the old one', async () => {
    const ada = await register('ada');
    await forgot('ada@example.com');

    const response = await reset(tokenFrom(lastEmail()), NEW_PASSWORD);

    expect(response.status).toBe(204);
    expect((await login(ada.email, NEW_PASSWORD)).status).toBe(200);
    expect((await login(ada.email, PASSWORD)).status).toBe(401);
  });

  it('signs out every device', async () => {
    const ada = await register('ada');
    await forgot('ada@example.com');

    await reset(tokenFrom(lastEmail()), NEW_PASSWORD);
    const refreshed = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: ada.refreshToken });

    expect(refreshed.status).toBe(401);
  });

  it('confirms the address too, since the link proves it is theirs', async () => {
    const ada = await register('ada');
    await forgot('ada@example.com');

    await reset(tokenFrom(lastEmail()), NEW_PASSWORD);
    const session = await login(ada.email, NEW_PASSWORD);

    expect(session.body.user.emailVerified).toBe(true);
  });

  it('works only once', async () => {
    await register('ada');
    await forgot('ada@example.com');
    const token = tokenFrom(lastEmail());

    const first = await reset(token, NEW_PASSWORD);
    const second = await reset(token, 'yet another password');

    expect(first.status).toBe(204);
    expect(second.status).toBe(400);
    expect((await login('ada@example.com', NEW_PASSWORD)).status).toBe(200);
  });

  it('does not use up the link when the new password is too weak', async () => {
    await register('ada');
    await forgot('ada@example.com');
    const token = tokenFrom(lastEmail());

    const weak = await reset(token, 'short');
    const fine = await reset(token, NEW_PASSWORD);

    expect(weak.status).toBe(400);
    expect(fine.status).toBe(204);
  });

  it('stops working after an hour', async () => {
    await register('ada');
    await forgot('ada@example.com');
    await db.userToken.updateMany({
      where: { purpose: 'PASSWORD_RESET' },
      data: { expiresAt: inThePast() },
    });

    const response = await reset(tokenFrom(lastEmail()), NEW_PASSWORD);

    expect(response.status).toBe(400);
    expect((await login('ada@example.com', PASSWORD)).status).toBe(200);
    expect(EMAIL_TOKEN_TTL_MS.PASSWORD_RESET).toBe(60 * 60 * 1000);
  });

  it('cannot be done with an email-confirmation link', async () => {
    await register('ada');
    const confirmation = tokenFrom(lastEmail());

    const response = await reset(confirmation, NEW_PASSWORD);

    expect(response.status).toBe(400);
    expect((await login('ada@example.com', PASSWORD)).status).toBe(200);
  });

  it('can be used by only one of two requests at the same instant', async () => {
    for (let round = 0; round < 6; round += 1) {
      await resetDb(db);
      mailer.outbox.length = 0;
      await register('ada');
      await forgot('ada@example.com');
      const token = tokenFrom(lastEmail());

      const results = await Promise.all([
        reset(token, 'first new password!'),
        reset(token, 'second new password!'),
      ]);

      expect(
        results.map((result) => result.status).sort(),
        `round ${round}`,
      ).toEqual([204, 400]);
    }
  });
});

describe('deleting the account', () => {
  /** Ada writes a shared route that Bob follows and rates. */
  async function adaAndBob() {
    const ada = await register('ada');
    const bob = await register('bob');
    await markVerified(db, ada.userId);
    await markVerified(db, bob.userId);
    const created = await request(app)
      .post('/routes')
      .set(ada.auth)
      .send({ title: 'Horror for beginners' });
    const routeId = created.body.route.id as string;
    for (const tmdbId of [1, 2, 3]) {
      await request(app)
        .post(`/routes/${routeId}/steps`)
        .set(ada.auth)
        .send({ tmdbId });
    }
    await request(app)
      .patch(`/routes/${routeId}`)
      .set(ada.auth)
      .send({ visibility: 'public' });
    await request(app).post(`/public/routes/${routeId}/join`).set(bob.auth);
    const journey = await request(app)
      .get(`/routes/${routeId}/journey`)
      .set(bob.auth);
    for (const step of journey.body.journey.steps as { id: string }[]) {
      await request(app)
        .post(`/routes/${routeId}/journey/steps/${step.id}/close`)
        .set(bob.auth)
        .send({ emotion: 'joy' });
    }
    await request(app)
      .put(`/routes/${routeId}/rating`)
      .set(bob.auth)
      .send({ score: 9 });
    return { ada, bob, routeId };
  }

  const deleteAccount = (auth: { Authorization: string }, password: string) =>
    request(app).delete('/auth/me').set(auth).send({ password });

  it('needs a signed-in user and the password again', async () => {
    const ada = await register('ada');

    const anonymous = await request(app)
      .delete('/auth/me')
      .send({ password: PASSWORD });
    const wrong = await deleteAccount(ada.auth, 'not the password');
    const missing = await request(app)
      .delete('/auth/me')
      .set(ada.auth)
      .send({});

    expect(anonymous.status).toBe(401);
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe('incorrect_password');
    expect(missing.status).toBe(400);
    expect(await db.user.count()).toBe(1);
  });

  it('removes the account for good', async () => {
    const ada = await register('ada');

    const response = await deleteAccount(ada.auth, PASSWORD);

    expect(response.status).toBe(204);
    expect(await db.user.count()).toBe(0);
    expect((await login(ada.email, PASSWORD)).status).toBe(401);
    // A session that was still valid stops working too.
    expect((await me(ada.auth)).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/auth/refresh')
          .send({ refreshToken: ada.refreshToken })
      ).status,
    ).toBe(401);
  });

  it('frees the address and the username for a new account', async () => {
    const ada = await register('ada');
    await deleteAccount(ada.auth, PASSWORD);

    const again = await register('ada');

    expect(again.response.status).toBe(201);
  });

  it('takes the author routes with it, and the travelers lose them', async () => {
    const { ada, bob, routeId } = await adaAndBob();

    await deleteAccount(ada.auth, PASSWORD);

    expect(await db.route.count()).toBe(0);
    expect(await db.routeStep.count()).toBe(0);
    expect(await db.enrollment.count()).toBe(0);
    expect(await db.stepProgress.count()).toBe(0);
    expect(await db.routeRating.count()).toBe(0);
    const view = await request(app)
      .get(`/routes/${routeId}/journey`)
      .set(bob.auth);
    expect(view.status).toBe(404);
    expect((await request(app).get(`/public/routes/${routeId}`)).status).toBe(
      404,
    );
  });

  it('takes the progress and votes of a traveler, leaving the route alone', async () => {
    const { ada, bob, routeId } = await adaAndBob();

    await deleteAccount(bob.auth, PASSWORD);

    expect(await db.route.count()).toBe(1);
    expect(await db.enrollment.count()).toBe(0);
    expect(await db.stepProgress.count()).toBe(0);
    expect(await db.routeRating.count()).toBe(0);
    const detail = await request(app).get(`/public/routes/${routeId}`);
    expect(detail.body.route).toMatchObject({
      completions: 0,
      rating: { votes: 0 },
    });
    expect((await me(ada.auth)).status).toBe(200);
  });

  it('leaves no tokens behind', async () => {
    const ada = await register('ada');
    await forgot('ada@example.com');

    await deleteAccount(ada.auth, PASSWORD);

    expect(await db.userToken.count()).toBe(0);
    expect(await db.refreshToken.count()).toBe(0);
  });

  it('warns beforehand how much it would take', async () => {
    const { ada, bob } = await adaAndBob();
    const carol = await register('carol');

    const adaImpact = await request(app)
      .get('/auth/me/deletion-impact')
      .set(ada.auth);
    const bobImpact = await request(app)
      .get('/auth/me/deletion-impact')
      .set(bob.auth);
    const carolImpact = await request(app)
      .get('/auth/me/deletion-impact')
      .set(carol.auth);
    const anonymous = await request(app).get('/auth/me/deletion-impact');

    expect(adaImpact.body).toEqual({ routes: 1, travelersAffected: 1 });
    expect(bobImpact.body).toEqual({ routes: 0, travelersAffected: 0 });
    expect(carolImpact.body).toEqual({ routes: 0, travelersAffected: 0 });
    expect(anonymous.status).toBe(401);
  });

  it('does not count travelers the author already removed', async () => {
    const { ada, bob, routeId } = await adaAndBob();
    const travelers = await request(app)
      .get(`/routes/${routeId}/travelers`)
      .set(ada.auth);
    await request(app)
      .delete(`/routes/${routeId}/travelers/${travelers.body.travelers[0].id}`)
      .set(ada.auth);

    const impact = await request(app)
      .get('/auth/me/deletion-impact')
      .set(ada.auth);

    expect(impact.body.travelersAffected).toBe(0);
    expect(bob.userId).toBeTruthy();
  });
});
