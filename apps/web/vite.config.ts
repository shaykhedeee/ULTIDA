import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const webDir = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  plugins: [react()],
  resolve: {
    // TypeScript paths cover typechecking; Vite needs the runtime workspace
    // alias as well when a package has no generated dist entry.
    alias: {
      '@ultida/layout-core': resolve(webDir, '../../packages/layout-core/src'),
    },
  },
  cacheDir: '.vite',
  // Vercel's npm install can omit Lightning CSS's optional native binding.
  // Esbuild keeps the production minification path portable across local and Linux builds.
  build: { outDir: 'dist', emptyOutDir: true, cssMinify: 'esbuild' },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8800', changeOrigin: true } }
  }
});
