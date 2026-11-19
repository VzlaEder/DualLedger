import { getDB } from './maestrosDb.js'

// ============================================================
// Documentos no fiscales - capa local (offline-first)
// Se guardan primero en IndexedDB y después se intenta sincronizar
// con la API. Nunca pasan por el Libro de Compras.
// ============================================================

export const TIPO_SYNC_DOCUMENTOS_NO_FISCALES = 'documentos_no_fiscales'

export async function saveDocumentoNoFiscalLocal(documento) {
  const db = await getDB()
  const row = { ...documento, actualizadoEn: Date.now() }
  await db.put('documentosNoFiscales', row)
  return row
}

export async function saveDocumentosNoFiscales(documentos) {
  const db = await getDB()
  const tx = db.transaction('documentosNoFiscales', 'readwrite')
  for (const d of documentos) tx.store.put({ ...d, actualizadoEn: Date.now() })
  await tx.done
  return documentos
}

export async function getDocumentosNoFiscales() {
  const db = await getDB()
  const docs = await db.getAll('documentosNoFiscales')
  return docs.sort((a, b) => {
    if (a.fecha !== b.fecha) return (b.fecha || '').localeCompare(a.fecha || '')
    return (a.numero || '').localeCompare(b.numero || '')
  })
}

export async function getDocumentoNoFiscal(uid) {
  const db = await getDB()
  return db.get('documentosNoFiscales', uid)
}

export async function borrarDocumentoNoFiscal(uid) {
  const db = await getDB()
  await db.delete('documentosNoFiscales', uid)
}

export async function countDocumentosNoFiscales() {
  const db = await getDB()
  return db.count('documentosNoFiscales')
}
