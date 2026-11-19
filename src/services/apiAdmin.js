// ============================================================
// DualLedger - Cliente de administración de la base de datos
// ============================================================

const API = '/api/admin'

async function req(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('application/json') ? await res.json() : await res.text()
  if (!res.ok) {
    const msg = data && typeof data === 'object' && data.error ? data.error : String(data)
    const err = new Error(msg)
    err.code = data && typeof data === 'object' ? data.code : undefined
    throw err
  }
  return data
}

export function getStatus() {
  return req('/status')
}

export function dbUp() {
  return req('/db/up', { method: 'POST', body: '{}' })
}

export function dbDown() {
  return req('/db/down', { method: 'POST', body: '{}' })
}

export function dbConnect(url) {
  return req('/db/connect', { method: 'POST', body: JSON.stringify({ url }) })
}

export function getTables() {
  return req('/tables')
}

export function getTableData(name, { limit = 100, offset = 0, order } = {}) {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (order) q.set('order', order)
  return req(`/tables/${name}?${q}`)
}

export function insertRow(name, row) {
  return req(`/tables/${name}/rows`, { method: 'POST', body: JSON.stringify({ row }) })
}

export function updateRow(name, key, row) {
  return req(`/tables/${name}/rows`, { method: 'PUT', body: JSON.stringify({ key, row }) })
}

export function deleteRows(name, keys) {
  return req(`/tables/${name}/rows`, { method: 'DELETE', body: JSON.stringify({ keys }) })
}

export function exportTableUrl(name, fmt) {
  return `${API}/export/${name}?fmt=${fmt}`
}

export function exportAllUrl(fmt) {
  return `${API}/export/all?fmt=${fmt}`
}

export async function downloadUrl(url, filename) {
  const res = await fetch(url)
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data && data.error) msg = data.error
    } catch { /* noop */ }
    throw new Error(msg)
  }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}

export function importInto(name, fmt, content) {
  return req(`/import/${name}`, { method: 'POST', body: JSON.stringify({ fmt, content }) })
}

export function importSql(content) {
  return req('/import/sql', { method: 'POST', body: JSON.stringify({ content }) })
}