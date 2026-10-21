const API_URL_KEY = 'dualledger:apiUrl'
const LEGACY_WORKER_URL_KEY = 'dualledger:seniatWorkerUrl'

// Configuracion de la API (backend separado del frontend).
// Por defecto el front usa la ruta /api, que en desarrollo apunta por proxy
// al servidor Express y en produccion al mismo origen o a VITE_API_URL.
// El override manual permite apuntar a otra API desplegada aparte.

export function getApiUrl() {
  try {
    const current = localStorage.getItem(API_URL_KEY)
    if (current) return current
    const legacy = localStorage.getItem(LEGACY_WORKER_URL_KEY)
    if (legacy) {
      localStorage.setItem(API_URL_KEY, legacy)
      return legacy
    }
    return ''
  } catch (e) {
    return ''
  }
}

export function setApiUrl(url) {
  try {
    if (url && url.trim()) {
      const clean = url.trim().replace(/\/+$/, '')
      localStorage.setItem(API_URL_KEY, clean)
    } else {
      localStorage.removeItem(API_URL_KEY)
    }
  } catch (e) { /* noop */ }
}

export function clearApiUrl() {
  try {
    localStorage.removeItem(API_URL_KEY)
  } catch (e) { /* noop */ }
}

// Alias heredados: el override antes se llamaba "URL del worker SENIAT".
export const getWorkerUrl = getApiUrl
export const setWorkerUrl = setApiUrl
export const clearWorkerUrl = clearApiUrl
