import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// El frontend NO importa el servidor: son dos procesos independientes.
// En desarrollo, Vite hace proxy de /api hacia la API standalone.
// En produccion, el front se sirve como estatico y VITE_API_URL apunta a la API.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787'
  const apiProxy = {
    '/api': {
      target: apiTarget,
      changeOrigin: true
    }
  }

  return {
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      installPrompt: true,
      includeAssets: [
        'favicon.ico',
        'icon-192.png',
        'icon-512.png',
        'icon-512-maskable.png',
        'apple-touch-icon.png'
      ],
      manifest: {
        id: '/',
        name: 'DualLedger - Libro de Compras',
        short_name: 'DualLedger',
        description: 'Extrae informacion de facturas de imagenes y genera Libros de Compras',
        lang: 'es',
        dir: 'ltr',
        categories: ['business', 'productivity', 'finance'],
        theme_color: '#1a56db',
        background_color: '#f3f5f9',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/assets\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/unpkg\.com\/tesseract.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: apiProxy
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: apiProxy
  }
  }
})
