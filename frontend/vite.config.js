// vite.config.js
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Lê variáveis do .env (opcional)
  const env = loadEnv(mode, process.cwd(), '')
  const BACKEND = env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        // Tudo que começar com /api vai para o Django
        '/api': {
          target: BACKEND,
          changeOrigin: true,
          // se o backend estiver em HTTPS com self-signed:
          // secure: false,
        },
      },
    },
  }
})
