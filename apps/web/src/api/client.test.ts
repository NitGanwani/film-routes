import { describe, expect, it } from 'vitest';
import {
  ApiError,
  REFRESH_TOKEN_KEY,
  createApiClient,
  type LockManagerLike,
  type TokenStorage,
} from './client.js';

const USER = {
  id: 'u1',
  username: 'ada',
  email: 'ada@example.com',
  locale: 'es',
  emailVerified: true,
  isAdmin: false,
};

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const error = (status: number, code: string) =>
  json(status, { error: { code, message: code } });

const pause = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A stand-in for the API with the same refresh rule as the real one: every
 * refresh token works once, and presenting a used one revokes the whole
 * family, so any double use shows up as `revokedEverything`.
 */
function createFakeApi() {
  let counter = 0;
  const validRefresh = new Set<string>();
  const usedRefresh = new Set<string>();
  let validAccess = new Set<string>();
  const api = {
    refreshCalls: 0,
    logoutBodies: [] as unknown[],
    revokedEverything: false,
    failRefreshWith: null as (() => Response) | null,
    breakNetwork: false,
    protectedAlways401: false,
    protectedCalls: 0,
    /** Makes the next protected call answer late (a slow connection). */
    slowNextProtected: false,
    newSession() {
      counter += 1;
      const tokens = {
        accessToken: `access-${counter}`,
        refreshToken: `refresh-${counter}`,
        expiresIn: 900,
      };
      validAccess.add(tokens.accessToken);
      validRefresh.add(tokens.refreshToken);
      return tokens;
    },
    /** The server stops accepting access tokens (e.g. they expired early). */
    expireAccessTokens() {
      validAccess = new Set();
    },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      if (api.breakNetwork) throw new TypeError('network down');
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      const headers = init?.headers as Record<string, string> | undefined;

      switch (url.pathname) {
        case '/auth/login':
          return json(200, { user: USER, tokens: api.newSession() });
        case '/auth/refresh': {
          api.refreshCalls += 1;
          await pause();
          if (api.failRefreshWith) return api.failRefreshWith();
          const token = body.refreshToken as string;
          if (usedRefresh.has(token)) {
            api.revokedEverything = true;
            validRefresh.clear();
            return error(401, 'invalid_refresh_token');
          }
          if (!validRefresh.has(token)) {
            return error(401, 'invalid_refresh_token');
          }
          usedRefresh.add(token);
          validRefresh.delete(token);
          return json(200, { tokens: api.newSession() });
        }
        case '/auth/logout':
          api.logoutBodies.push(body);
          return json(204, undefined);
        case '/protected': {
          api.protectedCalls += 1;
          const token = headers?.Authorization?.replace('Bearer ', '') ?? '';
          if (api.slowNextProtected) {
            api.slowNextProtected = false;
            // The decision is taken on arrival; only the answer is late.
            const accepted = validAccess.has(token);
            await pause(40);
            return accepted
              ? json(200, { ok: true })
              : error(401, 'unauthorized');
          }
          if (api.protectedAlways401 || !validAccess.has(token)) {
            return error(401, 'unauthorized');
          }
          return json(200, { ok: true });
        }
        case '/open':
          return json(200, { open: true });
        case '/empty':
          return json(204, undefined);
        case '/teapot':
          return error(418, 'teapot');
        default:
          return error(404, 'not_found');
      }
    },
  };
  return api;
}

function createMemoryStorage(): TokenStorage & { dump(): string } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    dump: () => JSON.stringify([...map.entries()]),
  };
}

/** Web Locks stand-in: callers take turns, in order. */
function createFakeLocks(): LockManagerLike {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    request(_name, callback) {
      const run = tail.then(() => callback());
      tail = run.catch(() => undefined);
      return run;
    },
  };
}

function setup(
  options: {
    api?: ReturnType<typeof createFakeApi>;
    storage?: ReturnType<typeof createMemoryStorage>;
    locks?: LockManagerLike | null;
    clock?: { now: number };
  } = {},
) {
  const api = options.api ?? createFakeApi();
  const storage = options.storage ?? createMemoryStorage();
  const clock = options.clock ?? { now: 1_000_000 };
  const client = createApiClient({
    baseUrl: 'http://api.test',
    storage,
    fetch: api.fetch,
    locks: options.locks === undefined ? createFakeLocks() : options.locks,
    now: () => clock.now,
  });
  return { api, storage, clock, client };
}

const credentials = { email: 'ada@example.com', password: 'secret-password' };
const protectedCall = (client: ReturnType<typeof setup>['client']) =>
  client.request<{ ok: boolean }>('/protected', { auth: true });
const MINUTE = 60_000;

describe('signing in and out', () => {
  it('keeps only the refresh token in storage, never the access token', async () => {
    const { client, storage } = setup();

    const user = await client.login(credentials);

    expect(user.username).toBe('ada');
    expect(client.hasSession()).toBe(true);
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1');
    expect(storage.dump()).not.toContain('access-1');
  });

  it('tells subscribers when the session starts and ends', async () => {
    const { client } = setup();
    const events: boolean[] = [];
    client.subscribe((signedIn) => events.push(signedIn));

    await client.login(credentials);
    await client.logout();

    expect(events).toEqual([true, false]);
  });

  it('tells the server which session to close', async () => {
    const { client, api } = setup();
    await client.login(credentials);

    await client.logout();

    expect(api.logoutBodies).toEqual([{ refreshToken: 'refresh-1' }]);
    expect(client.hasSession()).toBe(false);
  });

  it('signs out locally even if the server cannot be reached', async () => {
    const { client, api } = setup();
    await client.login(credentials);
    api.breakNetwork = true;

    await client.logout();

    expect(client.hasSession()).toBe(false);
  });

  it('resumes after a reload using the stored refresh token', async () => {
    const first = setup();
    await first.client.login(credentials);

    // A new page load: same storage, nothing in memory.
    const reloaded = setup({ api: first.api, storage: first.storage });

    expect(reloaded.client.hasSession()).toBe(true);
    expect((await protectedCall(reloaded.client)).ok).toBe(true);
    expect(first.api.refreshCalls).toBe(1);
  });
});

describe('renewing the access token', () => {
  it('does not renew while the token is fresh', async () => {
    const { client, api } = setup();
    await client.login(credentials);

    await protectedCall(client);
    await protectedCall(client);

    expect(api.refreshCalls).toBe(0);
  });

  it('renews shortly before it expires', async () => {
    const { client, api, clock } = setup();
    await client.login(credentials);

    clock.now += 14.8 * MINUTE; // 12 s left of 15 min: inside the margin
    await protectedCall(client);

    expect(api.refreshCalls).toBe(1);
  });

  it('shares one renewal between simultaneous requests', async () => {
    const { client, api, clock } = setup();
    await client.login(credentials);
    const events: boolean[] = [];
    client.subscribe((signedIn) => events.push(signedIn));
    clock.now += 20 * MINUTE;

    const results = await Promise.all(
      Array.from({ length: 6 }, () => protectedCall(client)),
    );

    expect(results.every((result) => result.ok)).toBe(true);
    expect(api.refreshCalls).toBe(1);
    expect(api.revokedEverything).toBe(false);
    // Renewing is not signing in again: nobody needs to hear about it.
    expect(events).toEqual([]);
  });

  it('uses the newer token instead of renewing again when its refusal arrives late', async () => {
    const { client, api } = setup();
    await client.login(credentials);
    api.expireAccessTokens();

    // The first request leaves with the old token but its refusal is slow.
    api.slowNextProtected = true;
    const slow = protectedCall(client);
    // The second one is refused at once and renews the token meanwhile.
    await pause(1);
    const fast = protectedCall(client);

    const results = await Promise.all([slow, fast]);

    expect(results.every((result) => result.ok)).toBe(true);
    expect(api.refreshCalls).toBe(1);
    expect(api.revokedEverything).toBe(false);
  });

  it('renews and retries once when the server refuses the token', async () => {
    const { client, api } = setup();
    await client.login(credentials);
    api.expireAccessTokens();

    const results = await Promise.all(
      Array.from({ length: 4 }, () => protectedCall(client)),
    );

    expect(results.every((result) => result.ok)).toBe(true);
    expect(api.refreshCalls).toBe(1);
    expect(api.revokedEverything).toBe(false);
  });

  it('gives up after one retry instead of looping', async () => {
    const { client, api } = setup();
    await client.login(credentials);
    api.protectedAlways401 = true;

    await expect(protectedCall(client)).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
    });
    expect(api.refreshCalls).toBe(1);
  });

  it('lets two tabs renew at the same time without replaying a token', async () => {
    const shared = setup();
    await shared.client.login(credentials);
    // Two tabs of the same browser: same storage and locks, separate memory.
    const locks = createFakeLocks();
    const tabA = setup({ ...shared, locks, clock: shared.clock });
    const tabB = setup({ ...shared, locks, clock: shared.clock });
    shared.clock.now += 20 * MINUTE;

    for (let round = 0; round < 3; round += 1) {
      shared.clock.now += 20 * MINUTE;
      const results = await Promise.all([
        protectedCall(tabA.client),
        protectedCall(tabB.client),
        protectedCall(tabA.client),
        protectedCall(tabB.client),
      ]);
      expect(results.every((result) => result.ok)).toBe(true);
    }

    expect(shared.api.revokedEverything).toBe(false);
    // One renewal per tab and round, never more.
    expect(shared.api.refreshCalls).toBe(6);
  });
});

describe('when renewing fails', () => {
  it('ends the session when the server rejects the refresh token', async () => {
    const { client, storage, api } = setup();
    await client.login(credentials);
    const events: boolean[] = [];
    client.subscribe((signedIn) => events.push(signedIn));
    api.expireAccessTokens();
    api.failRefreshWith = () => error(401, 'invalid_refresh_token');

    await expect(protectedCall(client)).rejects.toMatchObject({
      status: 401,
      code: 'invalid_refresh_token',
    });

    expect(events).toEqual([false]);
    expect(storage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    // Afterwards it does not even try the network.
    const callsBefore = api.refreshCalls;
    await expect(protectedCall(client)).rejects.toMatchObject({ status: 401 });
    expect(api.refreshCalls).toBe(callsBefore);
  });

  it('keeps the session when the network is down', async () => {
    const { client, api, clock } = setup();
    await client.login(credentials);
    const events: boolean[] = [];
    client.subscribe((signedIn) => events.push(signedIn));
    clock.now += 20 * MINUTE;
    api.breakNetwork = true;

    await expect(protectedCall(client)).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
    });
    api.breakNetwork = false;

    expect(client.hasSession()).toBe(true);
    expect(events).toEqual([]);
    expect((await protectedCall(client)).ok).toBe(true);
  });

  it('keeps the session on a server error', async () => {
    const { client, api, clock } = setup();
    await client.login(credentials);
    clock.now += 20 * MINUTE;
    api.failRefreshWith = () => error(503, 'unavailable');

    await expect(protectedCall(client)).rejects.toMatchObject({ status: 503 });

    expect(client.hasSession()).toBe(true);
  });

  it('follows another tab that signed out', async () => {
    const { client, storage, api } = setup();
    await client.login(credentials);
    const events: boolean[] = [];
    client.subscribe((signedIn) => events.push(signedIn));

    // The other tab logged out: the shared storage lost the token.
    storage.removeItem(REFRESH_TOKEN_KEY);
    client.syncFromStorage();
    const callsBefore = api.protectedCalls;

    expect(events).toEqual([false]);
    // Its access token is still fresh, but the session is gone: it must not
    // be used, and nothing should reach the server.
    await expect(protectedCall(client)).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
    });
    expect(api.protectedCalls).toBe(callsBefore);
    expect(api.refreshCalls).toBe(0);
  });
});

describe('plain requests', () => {
  it('does not need or touch a session for open endpoints', async () => {
    const { client, api } = setup();

    const body = await client.request<{ open: boolean }>('/open');

    expect(body.open).toBe(true);
    expect(api.refreshCalls).toBe(0);
  });

  it('answers undefined for 204', async () => {
    const { client } = setup();

    expect(await client.request('/empty')).toBeUndefined();
  });

  it('turns API errors into ApiError with the code the server sent', async () => {
    const { client } = setup();

    const failure = await client.request('/teapot').catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 418, code: 'teapot' });
  });

  it('reports an unreachable server as status 0', async () => {
    const { client, api } = setup();
    api.breakNetwork = true;

    await expect(client.request('/open')).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
    });
  });

  it('refuses an authenticated call when nobody is signed in', async () => {
    const { client, api } = setup();

    await expect(protectedCall(client)).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
    });
    expect(api.refreshCalls).toBe(0);
  });
});
