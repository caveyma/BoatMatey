import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: ['index.html', 'app/index.html'],
    },
  },
  plugins: [
    {
      name: 'rewrite-app',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url?.split('?')[0] ?? '';
          // SPA fallback: /app and /app/* (except static assets with extensions)
          if ((url === '/app' || url === '/app/' || url.startsWith('/app/')) && !/\.[a-zA-Z0-9]+$/.test(url)) {
            req.url = '/app/index.html';
          }
          next();
        });
      },
    },
  ],
});
