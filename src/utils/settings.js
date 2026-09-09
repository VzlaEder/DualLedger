const CF_TOKEN_KEY = 'dualledger:cfToken'
const CF_ACCOUNT_KEY = 'dualledger:cfAccountId'
const WORKER_URL_KEY = 'dualledger:seniatWorkerUrl'

// Esta capa centraliza el acceso a configuración "de sistema" (admin).
// Hoy usa localStorage; en el futuro (.exe + login) se sustituye internamente
// por archivo local/sesión sin cambiar el resto del código.

export function getCfToken() {
  try {
    return localStorage.getItem(CF_TOKEN_KEY) || ''
  } catch (e) {
    return ''
  }
}

export function setCfToken(token) {
  try {
    if (token && token.trim()) localStorage.setItem(CF_TOKEN_KEY, token.trim())
    else localStorage.removeItem(CF_TOKEN_KEY)
  } catch (e) { /* noop */ }
}

export function getCfAccountId() {
  try {
    return localStorage.getItem(CF_ACCOUNT_KEY) || ''
  } catch (e) {
    return ''
  }
}

export function setCfAccountId(id) {
  try {
    if (id && id.trim()) localStorage.setItem(CF_ACCOUNT_KEY, id.trim())
    else localStorage.removeItem(CF_ACCOUNT_KEY)
  } catch (e) { /* noop */ }
}

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

export function clearSeniatConfig() {
  try {
    localStorage.removeItem(CF_TOKEN_KEY)
    localStorage.removeItem(CF_ACCOUNT_KEY)
    localStorage.removeItem(WORKER_URL_KEY)
  } catch (e) { /* noop */ }
}
