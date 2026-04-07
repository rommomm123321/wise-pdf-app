import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3030',
        changeOrigin: true,
      },
      // Yjs real-time collaboration WebSocket → local backend
      '/yjs': {
        target: 'ws://127.0.0.1:3030',
        ws: true,
        changeOrigin: true,
      },
      // Tile-server WebSocket → Docker tile server directly (no backend hop needed)
      '/ws': {
        target: 'ws://127.0.0.1:8080',
        ws: true,
        changeOrigin: true,
      },
      // Tile HTTP endpoints → local backend (which proxies to Docker tile server)
      '/tiles': {
        target: 'http://127.0.0.1:3030',
        changeOrigin: true,
      },
      '/thumbnail': {
        target: 'http://127.0.0.1:3030',
        changeOrigin: true,
      },
      '/prepare': {
        target: 'http://127.0.0.1:3030',
        changeOrigin: true,
      },
      '/cache': {
        target: 'http://127.0.0.1:3030',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3030',
        changeOrigin: true,
      },
    }
  }
})