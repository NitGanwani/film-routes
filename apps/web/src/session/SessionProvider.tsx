import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/instance.js';
import type { User } from '../api/types.js';
import { setLanguage } from '../i18n/index.js';

type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: User };

type SessionValue = SessionState & {
  login(input: { email: string; password: string }): Promise<void>;
  register(input: {
    username: string;
    email: string;
    password: string;
    locale: 'es' | 'en';
  }): Promise<void>;
  logout(): Promise<void>;
  /** Asks the server who this is again (e.g. after confirming the email). */
  reloadUser(): Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>(
    api.hasSession()
      ? { status: 'loading', user: null }
      : { status: 'anonymous', user: null },
  );

  // Resume a stored session after a reload.
  useEffect(() => {
    if (!api.hasSession()) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const attempt = (retryIn: number) => {
      api
        .request<{ user: User }>('/auth/me', { auth: true })
        .then(({ user }) => {
          if (!cancelled) setState({ status: 'authenticated', user });
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          // Only a verdict from the server (the client already cleared the
          // session) means "signed out"; a network failure should not.
          if (!api.hasSession()) {
            setState({ status: 'anonymous', user: null });
            return;
          }
          // The server could not be reached: keep the session and try again,
          // waiting a bit longer each time, so the page recovers on its own
          // once the server is back instead of staying "loading" for ever.
          console.error(error);
          timer = setTimeout(
            () => attempt(Math.min(retryIn * 2, 15_000)),
            retryIn,
          );
        });
    };
    attempt(2_000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // The session ended somewhere (expired, or another tab logged out).
  useEffect(() => {
    const unsubscribe = api.subscribe((signedIn) => {
      if (!signedIn) {
        setState({ status: 'anonymous', user: null });
        queryClient.clear();
      }
    });
    const onStorage = () => api.syncFromStorage();
    window.addEventListener('storage', onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', onStorage);
    };
  }, [queryClient]);

  const reloadUser = useCallback(async () => {
    if (!api.hasSession()) return;
    try {
      const { user } = await api.request<{ user: User }>('/auth/me', {
        auth: true,
      });
      setState((current) =>
        current.status === 'authenticated'
          ? { status: 'authenticated', user }
          : current,
      );
    } catch {
      // Keep what we had: the next request will say if the session ended.
    }
  }, []);

  const enter = useCallback((user: User) => {
    setLanguage(user.locale);
    setState({ status: 'authenticated', user });
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      ...state,
      async login(input) {
        enter(await api.login(input));
      },
      async register(input) {
        enter(await api.register(input));
      },
      async logout() {
        await api.logout();
        queryClient.clear();
        setState({ status: 'anonymous', user: null });
      },
      reloadUser,
    }),
    [state, enter, queryClient, reloadUser],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession needs a SessionProvider');
  return value;
}
