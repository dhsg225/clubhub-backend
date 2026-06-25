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
      '/sponsor': 'http://localhost:4000',
      '/media': 'http://localhost:4000',
    },
  },
});
