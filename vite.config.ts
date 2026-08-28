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
      host: true,
      port: Number(process.env.PORT || env.PORT || env.VITE_PORT || 20010),
      allowedHosts: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: Number(process.env.PORT || env.PORT || env.VITE_PORT || 20010),
      allowedHosts: true,
    },
    build: {
      rollupOptions: {
        output: {
          // Split stable, rarely-changing libraries into their own chunk so
          // browsers can cache them across app deploys instead of
          // re-downloading them every time route/app code changes.
          // This project's Vite build runs on Rolldown, whose manualChunks
          // only accepts a function (unlike Rollup, which also accepts the
          // object-map shorthand) — hence the id-matching function below
          // instead of a plain object.
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (/[\\/](react|react-dom|react-router-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
            if (/[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/.test(id)) return 'vendor-i18n';
            if (/[\\/]lucide-react[\\/]/.test(id)) return 'vendor-icons';
          },
        },
      },
    },
  }
})
