import { createApiClient } from './client.js';

/** The one client the app uses. Tests build their own with `createApiClient`. */
export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  storage: localStorage,
  // Web Locks: renewals take turns across tabs (see client.ts).
  locks: 'locks' in navigator ? navigator.locks : null,
});
