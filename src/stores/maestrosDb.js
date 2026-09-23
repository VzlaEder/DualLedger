import { openDB } from 'idb'

// Base IndexedDB dedicada a los maestros del módulo de compras.
// Se mantiene separada de "image-info-pwa" (stores/db.js) para no
// conflictuar con su versión y permitir evolucionar el esquema con idb.
const DB_NAME = 'dualledger-maestros'
const DB_VERSION = 1

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cuentas')) {
          const store = db.createObjectStore('cuentas', { keyPath: 'codigo' })
          store.createIndex('nivel', 'nivel')
          store.createIndex('codigoPadre', 'codigoPadre')
          store.createIndex('grupo', 'grupo')
          store.createIndex('esMovimiento', 'esMovimiento')
        }
        if (!db.objectStoreNames.contains('proveedores')) {
          const store = db.createObjectStore('proveedores', { keyPath: 'rif' })
          store.createIndex('nombre', 'nombre')
        }
        if (!db.objectStoreNames.contains('conceptosIslr')) {
          db.createObjectStore('conceptosIslr', { keyPath: 'codigo' })
        }
        if (!db.objectStoreNames.contains('parametros')) {
          db.createObjectStore('parametros', { keyPath: 'clave' })
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true })
          store.createIndex('tipo', 'tipo')
          store.createIndex('pendiente', 'pendiente')
        }
      }
    })
  }
  return dbPromise
}

// === Cuentas contables ===

export async function saveCuentas(cuentas) {
  const db = await getDB()
  const tx = db.transaction('cuentas', 'readwrite')
  for (const c of cuentas) tx.store.put(c)
  await tx.done
}

export async function getCuentas() {
  const db = await getDB()
  return db.getAll('cuentas')
}

export async function getCuenta(codigo) {
  const db = await getDB()
  return db.get('cuentas', codigo)
}

export async function getHijas(codigoPadre) {
  const db = await getDB()
  return db.getAllFromIndex('cuentas', 'codigoPadre', codigoPadre)
}

export async function countCuentas() {
  const db = await getDB()
  return db.count('cuentas')
}

// === Conceptos de retención ISLR ===

export async function saveConceptos(conceptos) {
  const db = await getDB()
  const tx = db.transaction('conceptosIslr', 'readwrite')
  for (const c of conceptos) tx.store.put(c)
  await tx.done
}

export async function getConceptos() {
  const db = await getDB()
  return db.getAll('conceptosIslr')
}

export async function countConceptos() {
  const db = await getDB()
  return db.count('conceptosIslr')
}

// === Parámetros (config y meta de importación) ===

export async function getParametro(clave) {
  const db = await getDB()
  const row = await db.get('parametros', clave)
  return row ? row.valor : null
}

export async function setParametro(clave, valor) {
  const db = await getDB()
  await db.put('parametros', { clave, valor })
}

// === Cola de sincronización (reintentos cuando el server está caído) ===

export async function agregarPendiente(tipo, payload, meta = {}) {
  const db = await getDB()
  await db.add('syncQueue', {
    tipo,
    pendiente: true,
    intentos: 0,
    payload,
    meta,
    creadoEn: Date.now()
  })
}

export async function listPendientes(tipo) {
  const db = await getDB()
  return db.getAllFromIndex('syncQueue', 'tipo', tipo)
}

export async function borrarPendiente(id) {
  const db = await getDB()
  await db.delete('syncQueue', id)
}