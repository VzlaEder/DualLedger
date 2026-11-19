import { getDB } from './maestrosDb.js'

// ============================================================
// Artículos - capa local (offline-first)
// El alta se guarda en IndexedDB y después se intenta sincronizar
// con la API. Si no hay PostgreSQL, queda en la cola de reintentos.
// ============================================================

export const TIPO_SYNC_ARTICULOS = 'articulos'

export async function saveArticulos(articulos) {
  const db = await getDB()
  const tx = db.transaction('articulos', 'readwrite')
  for (const a of articulos) tx.store.put({ ...a, actualizadoEn: Date.now() })
  await tx.done
  return articulos
}

export async function getArticulos() {
  const db = await getDB()
  const rows = await db.getAll('articulos')
  return rows.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
}

export async function countArticulos() {
  const db = await getDB()
  return db.count('articulos')
}
