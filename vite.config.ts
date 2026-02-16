import { defineConfig, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function serverReloadPlugin() {
  return {
    name: 'server-reload',
    configureServer(server: ViteDevServer) {
      const { watcher } = server;
      watcher.add('./server/**');
      watcher.on('change', (path: string) => {
        if (path.includes('server')) {
          server.ws.send({ type: 'full-reload' });
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), serverReloadPlugin()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
