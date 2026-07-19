import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  cacheDir: 'C:/tmp/ultida-vite-cache',
  build: { outDir: 'C:/Users/USER/.codex/visualizations/2026/06/26/019f0397-226a-70f1-bac9-4286a0fe63a7/ultida-web-dist', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5173 }
});
