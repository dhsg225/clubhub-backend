import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://localhost:4000',
        rewrite: (path) => path.replace(/^\/api\/v1/, ''),
        changeOrigin: true,
      },
      '/api/audit': {
        target: 'http://localhost:3006',
        rewrite: (path) => path.replace(/^\/api\/audit/, ''),
        changeOrigin: true,
      },
    },
  },
});
