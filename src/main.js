import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import { showToast, showConfirm } from './utils/dialog.js'

const app = createApp(App)
app.use(router)
app.mount('#app')

if (import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      let updateSW = null
      updateSW = registerSW({
        immediate: true,
        onOfflineReady() {
          showToast('App lista para usar sin conexión', { type: 'success', duration: 4000 })
        },
        onNeedRefresh() {
          showConfirm(
            'Hay una versión nueva disponible de DualLedger. ¿Actualizar ahora?',
            {
              title: 'Actualización disponible',
              confirmText: 'Actualizar',
              cancelText: 'Más tarde'
            }
          ).then((accepted) => {
            if (accepted && updateSW) {
              updateSW(true)
            }
          })
        }
      })
    })
    .catch(() => {})
}
