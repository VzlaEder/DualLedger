import Tesseract from 'tesseract.js'
import { transcribeCaptchaWithGemini } from './gemini'
import { getWorkerUrl } from './settings'

const CACHE_PREFIX = 'dualledger-seniat:'
const MAX_ATTEMPTS = 3
const ATTEMPT_DELAY_MS = 3000

let WORKER_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:8787'
  : (import.meta.env.VITE_SENIAT_WORKER_URL || '')

function workerUrl() {
  return getWorkerUrl() || WORKER_URL
}

function workerAvailable() {
  return !!workerUrl()
}

function normalizeRif(rif) {
  return String(rif || '').replace(/\s+/g, '').toUpperCase()
}

function sanitizeCaptcha(text) {
  return String(text || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10)
}

const ERROR_NAME_PATTERN = /no\s+coincide|el\s+c[dó]digo|la\s+imagen|rechazad|no\s+es\s+correcto/i

function isErrorMessageLike(value) {
  return ERROR_NAME_PATTERN.test(String(value || ''))
}

function readCache(rif) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + rif)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

function writeCache(rif, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + rif, JSON.stringify(data))
  } catch (e) { /* sin espacio / privacidad */ }
}

async function postJson(path, body, signal) {
  const base = workerUrl()
  if (!base) throw new Error('El servicio SENIAT no está configurado. Usa el botón \u2699 Herramientas.')
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
  if (!res.ok) throw new Error(`Worker respondió HTTP ${res.status}`)
  return res.json()
}

async function solveCaptchaWithGemini(base64Image, signal) {
  const text = await transcribeCaptchaWithGemini(base64Image, { signal })
  const clean = sanitizeCaptcha(text)
  if (!clean) throw new Error('Gemini no pudo leer el captcha')
  return clean
}

async function solveCaptchaWithTesseract(base64Image) {
  const dataUrl = `data:image/jpeg;base64,${base64Image}`
  const result = await Tesseract.recognize(dataUrl, 'eng', {
    tessedit_pageseg_mode: '7',
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  })
  const clean = sanitizeCaptcha(result.data.text)
  if (!clean) throw new Error('Tesseract no pudo leer el captcha')
  return clean
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    const err = new Error('Verificación cancelada')
    err.name = 'AbortError'
    throw err
  }
}

async function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      const err = new Error('Verificación cancelada')
      err.name = 'AbortError'
      return reject(err)
    }
    const t = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      const err = new Error('Verificación cancelada')
      err.name = 'AbortError'
      reject(err)
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function lookupSharedCache(rif, signal) {
  try {
    const lookup = await postJson('/lookup', { rif }, signal)
    if (lookup && lookup.hit && lookup.ok) return lookup
  } catch (e) {
    if (e && e.name === 'AbortError') throw e
    console.warn('[SENIAT] lookup en cache compartida falló:', e)
  }
  return null
}

export async function verificarRifEnSeniat(rif, { forceRefresh = false, signal, onCaptchaNeeded } = {}) {
  const normalized = normalizeRif(rif)
  if (!normalized) throw new Error('No hay RIF para verificar')
  if (!workerAvailable()) throw new Error('El servicio SENIAT no está configurado. Usa el botón \u2699 Herramientas.')

  if (!forceRefresh) {
    const local = readCache(normalized)
    if (local && (local.nombreRazon || local.porcentajeContribucion != null)) {
      if (isErrorMessageLike(local.nombreRazon)) {
        writeCache(normalized, {})
      } else {
        return local
      }
    }

    const shared = await lookupSharedCache(normalized, signal)
    if (shared && !isErrorMessageLike(shared.nombreRazon)) {
      writeCache(normalized, shared)
      return shared
    }
  }

  let lastErr = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    throwIfAborted(signal)

    let captcha
    try {
      captcha = await postJson('/captcha', {}, signal)
    } catch (e) {
      if (e && e.name === 'AbortError') throw e
      captcha = null
      lastErr = e
    }
    if (!captcha || !captcha.ok) {
      const detail = (captcha && captcha.detail) || ''
      const errMsg = (captcha && captcha.error) || 'No se pudo obtener el captcha del SENIAT'
      if (detail.includes('Timeout') || detail.includes('timeout') || detail.includes('aborted')) {
        lastErr = new Error('El SENIAT no responde. Puede estar temporalmente fuera de servicio. Intenta de nuevo en unos minutos.')
      } else if (detail.includes('ECONNREFUSED') || detail.includes('fetch failed')) {
        lastErr = new Error('No se pudo conectar con el SENIAT. Verifica tu conexión a internet.')
      } else {
        lastErr = new Error(errMsg)
      }
      await delay(ATTEMPT_DELAY_MS, signal)
      continue
    }

    let codigo = null
    try {
      codigo = await solveCaptchaWithGemini(captcha.imageBase64, signal)
    } catch (e) {
      if (e && e.name === 'AbortError') throw e
      console.warn('[SENIAT] Gemini falló en captcha, usando Tesseract:', e)
      try {
        codigo = await solveCaptchaWithTesseract(captcha.imageBase64)
      } catch (e2) {
        lastErr = e2
      }
    }
    if (!codigo && typeof onCaptchaNeeded === 'function') {
      try {
        const manual = await onCaptchaNeeded(captcha)
        codigo = sanitizeCaptcha(manual)
      } catch (e) {
        if (e && e.name === 'AbortError') throw e
        lastErr = e
      }
    }
    if (!codigo) continue

    let verify
    try {
      verify = await postJson('/verify', { rif: normalized, codigo, cookies: captcha.cookies }, signal)
    } catch (e) {
      if (e && e.name === 'AbortError') throw e
      throw new Error((e && e.message) || 'Fall\u00f3 la consulta al SENIAT')
    }
    if (verify.ok) {
      const data = {
        rif: normalized,
        nombreRazon: verify.nombreRazon || '',
        porcentajeContribucion: verify.porcentajeContribucion,
        condicion: verify.condicion || ''
      }
      // Defensa: si el nombre devuelto parece mensaje de error del SENIAT,
      // no lo guardamos y volvemos a intentar (rechazo de captcha).
      if (isErrorMessageLike(verify.nombreRazon)) {
        lastErr = new Error('El captcha fue rechazado por el SENIAT')
        await delay(ATTEMPT_DELAY_MS, signal)
        continue
      }
      writeCache(normalized, { ...data, fromCache: false })
      return { ...data, fromCache: false }
    }
    if (verify.captchaError) {
      lastErr = new Error('El captcha fue rechazado por el SENIAT')
      await delay(ATTEMPT_DELAY_MS, signal)
      continue
    }
    throw new Error(verify.error || 'El SENIAT no devolvió datos')
  }

  throw lastErr || new Error('No se pudo verificar el RIF en el SENIAT')
}