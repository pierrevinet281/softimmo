import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API server port. Use a DEDICATED env var, not PORT — some launchers (e.g. the
// preview tool) set PORT to the web/dev-server port, which would misdirect the proxy.
const API_PORT = process.env.SOFTIMMO_API_PORT || process.env.LEADGEN_API_PORT || 8787;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: false,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
