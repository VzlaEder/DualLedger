import { getApiUrl } from './settings.js'

// Base de la API. Prioridad:
//  1) override manual en localStorage
//  2) VITE_API_URL (build de produccion que apunta a la API desplegada)
//  3) VITE_SENIAT_WORKER_URL (compatibilidad con builds anteriores)
//  4) /api (mismo origen: proxy de Vite en dev, o API tras el mismo dominio)
const ENV = import.meta.env || {}
const ENV_BASE = (ENV.VITE_API_URL || ENV.VITE_SENIAT_WORKER_URL || '').replace(/\/+$/, '')
const DEFAULT_BASE = ENV_BASE || '/api'

export function resolveApiBase() {
  const override = getApiUrl()
  return (override || DEFAULT_BASE).replace(/\/+$/, '')
}

async function request(path, { method = 'GET', body, signal, base } = {}) {
  const url = `${base || resolveApiBase()}${path}`
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal
  })
  if (!res.ok) {
    let message = `El servidor respondió HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data && data.error) message = data.error
    } catch (e) { /* respuesta sin cuerpo JSON */ }
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return res.json()
}

export async function postJson(path, body, opts = {}) {
  return request(path, { ...opts, method: 'POST', body })
}

export async function getJson(path, opts = {}) {
  return request(path, { ...opts, method: 'GET' })
}

export async function putJson(path, body, opts = {}) {
  return request(path, { ...opts, method: 'PUT', body })
}

export async function deleteJson(path, opts = {}) {
  return request(path, { ...opts, method: 'DELETE' })
}
