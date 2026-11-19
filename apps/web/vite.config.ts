import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The person decides when to switch to a new version (see pwa/register).
      registerType: 'prompt',
      injectRegister: false,
      // The manifest and the icons are already in public/: the plugin only
      // brings the service worker.
      manifest: false,
      workbox: {
        // The app's own files. Not the share image (only crawlers read it).
        // TMDB posters are not kept here: they come from another domain
        // without CORS headers, and each one would weigh ~7 MB of quota.
        // Nothing from the API either: sessions and private journeys.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
        globIgnores: ['og-image.png'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    // The API only allows this origin (CORS_ORIGINS), so do not drift to
    // another port silently: fail instead.
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
