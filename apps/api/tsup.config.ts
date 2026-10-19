import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // The shared package is exported as TypeScript source, so it must be bundled.
  noExternal: ['@film-routes/shared'],
});
