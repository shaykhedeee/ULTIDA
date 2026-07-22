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
  build: { outDir: 'dist', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5173 }
});
