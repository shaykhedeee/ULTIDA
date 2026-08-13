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
      '@ultida/spaces-core': resolve(webDir, '../../packages/spaces-core/src'),
      '@ultida/contracts': resolve(webDir, '../../packages/contracts/src'),
    },
  },
  cacheDir: '.vite',
  // Vercel's npm install can omit Lightning CSS's optional native binding.
  // Esbuild keeps the production minification path portable across local and Linux builds.
  build: {
    outDir: 'dist', emptyOutDir: true, cssMinify: 'esbuild',
    // Scene Studio's isolated Three.js runtime is intentionally lazy-loaded.
    // Keep the warning threshold above that on-demand vendor island while the
    // initial application shell remains comfortably below the normal limit.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Three.js is used only by Scene Studio. Keeping it as an explicit
        // vendor island prevents it from being coalesced with route code and
        // makes the initial dashboard/download path substantially lighter.
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three-runtime';
          if (id.includes('node_modules/@supabase/')) return 'supabase-runtime';
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8800', changeOrigin: true } }
  }
});
