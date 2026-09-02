import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      installPrompt: true,
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'DualLedger - Libro de Compras',
        short_name: 'DualLedger',
        description: 'Extrae información de facturas de imágenes y genera Libros de Compras',
        theme_color: '#1a56db',
        background_color: '#f3f5f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/unpkg\.com\/tesseract.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 3000
  }
})
