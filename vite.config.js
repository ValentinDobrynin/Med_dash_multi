import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// В dev-режиме клиент всегда ходит на /api/*, а vite проксирует
// на VITE_API_URL (Render или локальный storage-сервис), срезая префикс /api.
// В проде тот же /api/* перехватывает Vercel rewrite → api/proxy.js.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_URL || 'http://localhost:8000';
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
