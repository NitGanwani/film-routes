import i18next from 'i18next';
import { registerSW } from 'virtual:pwa-register';
import { showToast } from '../components/toast/store.js';

/** How often an open tab asks whether a new version was published. */
export const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Installs the service worker (production only: in development a worker in
 * between only gets in the way). It keeps the app's own files, so the app
 * opens without a network; it never keeps what the API answers.
 *
 * A new version is not applied by itself: reloading under someone who is in
 * the middle of a note would lose it. A notice offers it, and the person says
 * when.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const update = registerSW({
    onNeedRefresh() {
      showToast({
        kind: 'update',
        title: i18next.t('toast.update'),
        detail: i18next.t('toast.updateDetail'),
        action: {
          label: i18next.t('toast.updateNow'),
          run: () => void update(true),
        },
      });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // A tab can stay open for days: ask now and then.
      window.setInterval(() => {
        // Offline, an update check only fails: skip it.
        if (navigator.onLine) void registration.update().catch(() => {});
      }, UPDATE_CHECK_MS);
    },
  });
}
