import type { User } from './types.js';

/** What the API (or the network) said went wrong. `status` 0 = no answer. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Tokens = {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
};

/** The part of `localStorage` the client needs. */
export type TokenStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The part of `navigator.locks` (Web Locks API) the client needs. */
export type LockManagerLike = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};

export type ClientOptions = {
  baseUrl: string;
  storage: TokenStorage;
  fetch?: typeof fetch;
  /** Serialises refreshes across tabs. `null` = this browser has no locks. */
  locks?: LockManagerLike | null;
  now?: () => number;
};

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send the access token (renewing it first if needed). Default: no. */
  auth?: boolean;
};

export type SessionListener = (signedIn: boolean) => void;

export const REFRESH_TOKEN_KEY = 'film-routes.refresh-token';
const REFRESH_LOCK = 'film-routes.refresh';
// Renew a little early so a token does not expire between choosing it and the
// server reading it.
const EXPIRY_MARGIN_MS = 30_000;

/**
 * Talks to the API and owns the session.
 *
 * The API rotates refresh tokens: each one works exactly once, and presenting
 * one that was already used is read as theft, which signs out EVERY device. So
 * the one thing this client must never do is send the same refresh token
 * twice. That is why renewals are serialised twice over:
 *  - inside a tab, concurrent requests share one in-flight renewal;
 *  - across tabs, a Web Lock makes them take turns, and each reads the newest
 *    token from storage only once it holds the lock.
 *
 * The access token lives in memory only. The refresh token lives in storage so
 * the session survives a reload (the API hands it over in the response body,
 * not as a cookie).
 */
export function createApiClient(options: ClientOptions) {
  const {
    baseUrl,
    storage,
    fetch: fetchFn = (...args) => globalThis.fetch(...args),
    locks = null,
    now = () => Date.now(),
  } = options;

  let access: { token: string; expiresAt: number } | null = null;
  let signedIn = storage.getItem(REFRESH_TOKEN_KEY) !== null;
  let renewal: Promise<string> | null = null;
  const listeners = new Set<SessionListener>();

  function setSignedIn(next: boolean) {
    if (signedIn === next) return;
    signedIn = next;
    for (const listener of listeners) listener(next);
  }

  function saveTokens(tokens: Tokens) {
    access = {
      token: tokens.accessToken,
      expiresAt: now() + tokens.expiresIn * 1000,
    };
    storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    setSignedIn(true);
  }

  function clearSession() {
    access = null;
    storage.removeItem(REFRESH_TOKEN_KEY);
    setSignedIn(false);
  }

  async function send(path: string, init: RequestOptions, token?: string) {
    const headers: Record<string, string> = {};
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await fetchFn(`${baseUrl}${path}`, {
        method: init.method ?? 'GET',
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new ApiError(0, 'network_error', 'Could not reach the server');
    }
  }

  async function toApiError(response: Response) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    return new ApiError(
      response.status,
      body?.error?.code ?? 'unknown',
      body?.error?.message ?? 'Unexpected error',
    );
  }

  /** The one place a refresh token is spent. Runs while holding the lock. */
  async function renewOnce(): Promise<string> {
    // Read it now, not before waiting for the lock: another tab may have
    // rotated it while we waited, and the old value would now be a "replay".
    const refreshToken = storage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      clearSession();
      throw new ApiError(401, 'unauthorized', 'Not signed in');
    }
    const response = await send('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
    if (!response.ok) {
      const error = await toApiError(response);
      // Only a verdict from the server ends the session. A network failure or
      // a 5xx says nothing about the token: keep it and let the caller retry.
      if (response.status === 401) clearSession();
      throw error;
    }
    const { tokens } = (await response.json()) as { tokens: Tokens };
    saveTokens(tokens);
    return tokens.accessToken;
  }

  function renewAccessToken(): Promise<string> {
    if (!renewal) {
      const run = locks ? locks.request(REFRESH_LOCK, renewOnce) : renewOnce();
      renewal = run.finally(() => {
        renewal = null;
      });
    }
    return renewal;
  }

  async function accessToken(): Promise<string> {
    if (access && access.expiresAt - now() > EXPIRY_MARGIN_MS) {
      return access.token;
    }
    // Not signed in is detected inside the renewal, where the token is read.
    return renewAccessToken();
  }

  async function request<T>(
    path: string,
    init: RequestOptions = {},
  ): Promise<T> {
    let token = init.auth ? await accessToken() : undefined;
    let response = await send(path, init, token);

    if (init.auth && response.status === 401) {
      // The server did not accept the token (revoked, or expired early). Use a
      // newer one if a concurrent request already got it; else renew. Once.
      token =
        access && access.token !== token
          ? access.token
          : await renewAccessToken();
      response = await send(path, init, token);
    }

    if (!response.ok) throw await toApiError(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async function authenticate(path: string, body: unknown): Promise<User> {
    const result = await request<{ user: User; tokens: Tokens }>(path, {
      method: 'POST',
      body,
    });
    saveTokens(result.tokens);
    return result.user;
  }

  return {
    request,

    login: (input: { email: string; password: string }) =>
      authenticate('/auth/login', input),

    register: (input: {
      username: string;
      email: string;
      password: string;
      locale?: 'es' | 'en';
    }) => authenticate('/auth/register', input),

    /** Signs out here first; telling the server is best effort. */
    async logout() {
      const refreshToken = storage.getItem(REFRESH_TOKEN_KEY);
      clearSession();
      if (!refreshToken) return;
      await send('/auth/logout', {
        method: 'POST',
        body: { refreshToken },
      }).catch(() => undefined);
    },

    /** True when there is a stored session (it may still turn out expired). */
    hasSession: () => storage.getItem(REFRESH_TOKEN_KEY) !== null,

    /** Another tab signed in or out: follow it. Wire to the `storage` event. */
    syncFromStorage() {
      const stored = storage.getItem(REFRESH_TOKEN_KEY) !== null;
      if (!stored) access = null;
      setSignedIn(stored);
    },

    subscribe(listener: SessionListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
