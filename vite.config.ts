import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function serverReloadPlugin() {
  return {
    name: 'server-reload',
    configureServer(server) {
      const { watcher } = server;
      watcher.add('./server/**');
      watcher.on('change', (path) => {
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
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
