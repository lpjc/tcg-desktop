import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: '.',
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
