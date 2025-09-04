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
      // 👇 IMPORTANTÍSSIMO pro import "@/..."
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        // tudo que começa com /api vai para o Django (sem CORS)
        '/api': {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
