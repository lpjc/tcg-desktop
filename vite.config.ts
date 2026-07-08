import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: '.',
  // Relative base so the built site works from any subpath (itch.io serves
  // uploads from a nested URL). Runtime asset URLs go through assetUrl().
  base: './',
  publicDir: 'assets',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
