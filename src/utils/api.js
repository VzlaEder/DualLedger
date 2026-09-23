import { getWorkerUrl } from './settings'

const DEFAULT_BASE = import.meta.env.VITE_SENIAT_WORKER_URL || '/api'

function resolveBase() {
  return getWorkerUrl() || DEFAULT_BASE
}

export async function postJson(path, body, opts = {}) {
  const { signal, base } = opts
  const res = await fetch(`${base || resolveBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  })
  if (!res.ok) {
    const err = new Error(`El servidor respondió HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

export async function getJson(path, opts = {}) {
  const { signal, base } = opts
  const res = await fetch(`${base || resolveBase()}${path}`, { method: 'GET', signal })
  if (!res.ok) {
    const err = new Error(`El servidor respondió HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}