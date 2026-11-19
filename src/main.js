import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import { showToast } from './utils/dialog.js'

const app = createApp(App)
app.use(router)
app.mount('#app')

if (import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onOfflineReady() {
          showToast('App lista para usar sin conexión', { type: 'success', duration: 4000 })
        },
        onRegisteredSW(_url, registration) {
          // Comprobacion periodica: en movil los despliegues nuevos llegan
          // por push del SW, no por el evento beforeinstallprompt.
          if (!registration) return
          setInterval(() => registration.update(), 60 * 60 * 1000)
        }
      })
    })
    .catch(() => {})
}
