import { getDB } from './maestrosDb.js'

// ============================================================
// Activos Fijos - capa local (offline-first)
// El alta se guarda en IndexedDB y después se intenta sincronizar
// con la API. Si no hay PostgreSQL, queda en la cola de reintentos.
// ============================================================

export const TIPO_SYNC_ACTIVOS_FIJOS = 'activosFijos'

export async function saveActivosFijos(activos) {
  const db = await getDB()
  const tx = db.transaction('activosFijos', 'readwrite')
  for (const a of activos) tx.store.put({ ...a, actualizadoEn: Date.now() })
  await tx.done
  return activos
}

export async function getActivosFijos() {
  const db = await getDB()
  const rows = await db.getAll('activosFijos')
  return rows.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
}

export async function countActivosFijos() {
  const db = await getDB()
  return db.count('activosFijos')
}
