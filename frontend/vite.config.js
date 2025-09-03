// vite.config.js
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const BACKEND = env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      host: '127.0.0.1',     // <-- aqui!
      port: 5173,
      strictPort: true,
      hmr: { host: '127.0.0.1', port: 5173 },  // evita problemas no WS do HMR
      proxy: {
        '/api': {
          target: BACKEND,
          changeOrigin: true,
          // secure: false, // se usar HTTPS self-signed
        },
      },
    },
  }
})
