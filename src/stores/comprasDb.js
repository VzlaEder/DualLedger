import { getDB } from './maestrosDb.js'

// ============================================================
// Documentos del Libro de Compras (capa local / offline-first)
// ============================================================
// Cada documento se guarda primero en IndexedDB (con `sincronizado: false`)
// y luego se envÃ­a a la API. Si la API no responde, el documento queda
// marcado como pendiente y la cola `syncQueue` lo reintenta despuÃ©s.
// ============================================================

export const TIPO_SYNC_COMPRAS = 'compras_documento'

// Genera un uid estable para un registro del editor.
export function generarUid(prefix = 'doc') {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${rand}`
}

export async function guardarDocumentoLocal(documento) {
  const db = await getDB()
  const row = {
    ...documento,
    uid: documento.uid || generarUid(),
    sincronizado: 0, // 0 = pendiente, 1 = sincronizado
    actualizadoEn: Date.now()
  }
  await db.put('comprasDocumentos', row)
  return row
}

export async function guardarDocumentosLocal(documentos) {
  const db = await getDB()
  const tx = db.transaction('comprasDocumentos', 'readwrite')
  const guardados = []
  for (const d of documentos) {
    const row = {
      ...d,
      uid: d.uid || generarUid(),
      sincronizado: 0, // 0 = pendiente, 1 = sincronizado
      actualizadoEn: Date.now()
    }
    tx.store.put(row)
    guardados.push(row)
  }
  await tx.done
  return guardados
}

export async function marcarSincronizado(uid, servidor = {}) {
  const db = await getDB()
  const row = await db.get('comprasDocumentos', uid)
  if (!row) return null
  const updated = { ...row, ...servidor, sincronizado: 1, sincronizadoEn: Date.now() }
  await db.put('comprasDocumentos', updated)
  return updated
}

export async function getDocumentosLocales() {
  const db = await getDB()
  const docs = await db.getAll('comprasDocumentos')
  return docs.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
}

export async function getDocumentoLocal(uid) {
  const db = await getDB()
  return db.get('comprasDocumentos', uid)
}

export async function getDocumentosPendientes() {
  const db = await getDB()
  return db.getAllFromIndex('comprasDocumentos', 'sincronizado', 0)
}

export async function eliminarDocumentoLocal(uid) {
  const db = await getDB()
  await db.delete('comprasDocumentos', uid)
}

export async function contarDocumentosLocales() {
  const db = await getDB()
  return db.count('comprasDocumentos')
}
