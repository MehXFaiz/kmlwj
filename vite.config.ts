import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_URL || 'http://localhost:4000'

  return {
    plugins: [
      react(),
      tailwindcss()
    ],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Split stable, rarely-changing libraries into their own chunk so
          // browsers can cache them across app deploys instead of
          // re-downloading them every time route/app code changes.
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
  }
})
