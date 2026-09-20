const WORKER_URL_KEY = 'dualledger:seniatWorkerUrl'

// Capa centralizada de configuración del servicio SENIAT.
// Por defecto la app usa el proxy local embebido (ruta /api).
// Esta URL es un override opcional para apuntar a otro backend (ej. dominio propio).

export function getWorkerUrl() {
  try {
    return localStorage.getItem(WORKER_URL_KEY) || ''
  } catch (e) {
    return ''
  }
}

export function setWorkerUrl(url) {
  try {
    if (url && url.trim()) localStorage.setItem(WORKER_URL_KEY, url.trim())
    else localStorage.removeItem(WORKER_URL_KEY)
  } catch (e) { /* noop */ }
}

export function clearWorkerUrl() {
  try {
    localStorage.removeItem(WORKER_URL_KEY)
  } catch (e) { /* noop */ }
}