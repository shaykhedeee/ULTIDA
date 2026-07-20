import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  cacheDir: 'C:/tmp/ultida-vite-cache-v2',
  build: { outDir: 'dist', emptyOutDir: false },
  server: { host: '127.0.0.1', port: 5173 }
});
