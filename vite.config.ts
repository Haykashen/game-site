import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * The whole app is bundled into a single self-contained `dist/index.html`:
 * CSS and JS are inlined by vite-plugin-singlefile, so the file can be opened
 * directly from the filesystem or dropped on any static host.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 2_000,
    reportCompressedSize: false,
  },
});
