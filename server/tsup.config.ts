import { defineConfig } from 'tsup';

/**
 * The shared workspace package exports TypeScript sources, which Node cannot
 * load directly from `dist`. Bundle it into the server build so `npm start`
 * works without a separate shared-package build step.
 */
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@discvault/shared'],
});
