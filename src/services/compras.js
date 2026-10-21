import { getJson, postJson, putJson, deleteJson } from '../utils/api.js'
import {
  guardarDocumentosLocal,
  marcarSincronizado,
  getDocumentosLocales,
  eliminarDocumentoLocal,
  generarUid
} from '../stores/comprasDb.js'
import { agregarPendiente, listPendientes, borrarPendiente, getProveedores } from '../stores/maestrosDb.js'

// ============================================================
// Servicio del Libro de Compras (front <-> API)
// ============================================================
// Estrategia offline-first: el documento se guarda siempre en
// IndexedDB y se intenta enviar a la API. Si la API no responde,
// queda en la cola de sincronización para reintentar después.
// ============================================================

export const TIPO_SYNC_COMPRAS = 'compras_documento'

export function normalizarRif(rif) {
  return String(rif || '').replace(/[\s-]/g, '').toUpperCase()
}

// --- Reglas fiscales (verificadas con el Libro real del cliente) ---
//   Total de Compras = Base Nac + Cred.Fiscal Nac + No Gravadas
//                      + Base Imp + Cred.Fiscal Imp
//   Credito Fiscal Nac = Base Imponible Nac × Alicuota
//   Ret IVA = Base Imponible Nac × Alicuota × %Contribucion
// ============================================================

export function calcularCreditoFiscal(record) {
  const base = Number(record.baseNacional) || 0
  const alicuota = Number(record.alicuotaNac) || 16
  if (!base) return 0
  return Math.round(base * alicuota) / 100
}

export function calcularTotalCompras(record) {
  const base = Number(record.baseNacional) || 0
  const cf = Number(record.creditoFiscalNac) || 0
  const noGrav = Number(record.noGravadas) || 0
  const baseImp = Number(record.baseImportacion) || 0
  const cfImp = Number(record.creditoFiscalImp) || 0
  return Math.round((base + cf + noGrav + baseImp + cfImp) * 100) / 100
}

// Retención de IVA sugerida (base × alícuota × % contribución).
export function calcularRetIva(record) {
  const base = Number(record.baseNacional) || 0
  const alicuota = Number(record.alicuotaNac) || 16
  const pct = Number(record.porcentajeContribucion) || 0
  if (!base || !pct) return null
  return Math.round(base * alicuota * pct) / 10000
}

// --- Maestros de proveedores ---

let proveedoresCache = null

export async function cargarProveedores({ force = false } = {}) {
  if (!force && proveedoresCache) return proveedoresCache
  try {
    const res = await getJson('/proveedores')
    proveedoresCache = res.proveedores || []
  } catch (e) {
    proveedoresCache = await getProveedores().catch(() => [])
  }
  return proveedoresCache
}

export function buscarProveedorEnLista(lista, rif) {
  const r = normalizarRif(rif)
  if (!r) return null
  return (lista || []).find((p) => normalizarRif(p.rif) === r) || null
}

// Busca el proveedor en el maestro local y, si no está, en la API.
export async function buscarProveedor(rif) {
  const r = normalizarRif(rif)
  if (!r) return null
  const locales = await getProveedores().catch(() => [])
  const local = buscarProveedorEnLista(locales, r)
  if (local) return local
  const remotos = await cargarProveedores()
  return buscarProveedorEnLista(remotos, r)
}

// Rellena los campos que dependen del proveedor.
// Sólo completa lo que está vacío, salvo el % de contribución (que es
// el dato fiscal que manda) y la cuenta contable por defecto.
export function autoCompletarProveedor(record, proveedor, opciones = {}) {
  if (!proveedor) return {}
  const forzar = !!opciones.forzar
  const cambios = {}
  const vacio = (v) => v === undefined || v === null || v === '' || (typeof v === 'number' && v === 0)
  // Por defecto sólo se rellenan los campos vacíos: el dato del documento manda.
  // Con { forzar: true } gana el maestro (selección explícita del usuario).
  const set = (campo, valor) => {
    if (valor === null || valor === undefined || valor === '') return
    if (!forzar && !vacio(record[campo])) return
    cambios[campo] = valor
  }

  set('nombreRazon', proveedor.nombre)
  set('condicion', proveedor.condicion)
  set('proveedorRif', normalizarRif(proveedor.rif))
  set('codigoCuenta', proveedor.codigoCuenta)
  set('diasCredito', proveedor.diasCredito)
  set('conceptoIslr', proveedor.conceptoIslr)

  // El % de contribución del maestro rellena el campo vacío.
  const pct = Number(proveedor.porcentajeRetIva)
  if (pct && (forzar || vacio(record.porcentajeContribucion))) {
    cambios.porcentajeContribucion = pct
  }
  return cambios
}

// --- Persistencia ---

export function prepararDocumento(record) {
  return {
    uid: record.uid || generarUid(),
    nro: Number(record.nro) || null,
    tipoDocumento: record.tipoDocumento || 'factura',
    fecha: record.fecha || '',
    rif: record.rif || '',
    nombreRazon: record.nombreRazon || '',
    porcentajeContribucion: record.porcentajeContribucion === '' || record.porcentajeContribucion === null || record.porcentajeContribucion === undefined
      ? ''
      : Number(record.porcentajeContribucion),
    condicion: record.condicion || '',
    nroFactura: record.nroFactura || '',
    nroControl: record.nroControl || '',
    numeroMaquinaFiscal: record.numeroMaquinaFiscal || '',
    nroNotaDebito: record.nroNotaDebito || '',
    nroNotaCredito: record.nroNotaCredito || '',
    tipoTransaccion: record.tipoTransaccion || '01 -Reg',
    nroFacturaAfectada: record.nroFacturaAfectada || '',
    totalComprasIVA: Number(record.totalComprasIVA) || 0,
    noGravadas: Number(record.noGravadas) || 0,
    baseNacional: Number(record.baseNacional) || 0,
    alicuotaNac: Number(record.alicuotaNac) || 16,
    creditoFiscalNac: Number(record.creditoFiscalNac) || 0,
    baseImportacion: Number(record.baseImportacion) || 0,
    alicuotaImp: Number(record.alicuotaImp) || 16,
    creditoFiscalImp: Number(record.creditoFiscalImp) || 0,
    numExpediente: record.numExpediente || '',
    numPlanilla: record.numPlanilla || '',
    fechaPlanilla: record.fechaPlanilla || '',
    retIVA: Number(record.retIVA) || 0,
    comprobanteIVA: record.comprobanteIVA || '',
    fechaIVA: record.fechaIVA || '',
    igtf: Number(record.igtf) || 0,
    proveedorRif: record.proveedorRif || '',
    codigoCuenta: record.codigoCuenta || '',
    diasCredito: Number(record.diasCredito) || 0,
    conceptoIslr: record.conceptoIslr || '',
    estado: record.estado || 'BORRADOR',
    origen: record.origen || 'ocr',
    origenArchivo: record.origenArchivo || record.source || '',
    motorOcr: record.engine || '',
    notas: record.note || '',
    documentoPadreUid: record.documentoPadreUid || ''
  }
}

// Guarda los documentos: primero en local, después en la API.
// Devuelve { guardados, errores, offline }.
export async function guardarDocumentos(records) {
  const docs = records.map(prepararDocumento)
  const locales = await guardarDocumentosLocal(docs)

  try {
    const res = await postJson('/compras/documentos/sync', { documentos: locales })
    for (const d of res.documentos || []) {
      await marcarSincronizado(d.uid, d)
    }
    return { guardados: res.guardados || 0, errores: res.errores || [], offline: false }
  } catch (e) {
    for (const d of locales) {
      await agregarPendiente(TIPO_SYNC_COMPRAS, d, { uid: d.uid })
    }
    return { guardados: 0, errores: [], offline: true, error: e.message }
  }
}

export async function sincronizarPendientes() {
  const pendientes = await listPendientes(TIPO_SYNC_COMPRAS)
  if (!pendientes.length) return { sincronizados: 0, errores: [] }
  const docs = pendientes.map((p) => p.payload).filter(Boolean)
  const res = await postJson('/compras/documentos/sync', { documentos: docs })
  for (const d of res.documentos || []) {
    await marcarSincronizado(d.uid, d)
    const entrada = pendientes.find((p) => p.payload && p.payload.uid === d.uid)
    if (entrada) await borrarPendiente(entrada.id)
  }
  return { sincronizados: res.guardados || 0, errores: res.errores || [] }
}

// Lista los documentos. Si la API no responde, devuelve los locales.
export async function listarDocumentos(filtros = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== '' && v !== null && v !== undefined) params.set(k, v)
  }
  try {
    const res = await getJson('/compras/documentos?' + params.toString())
    return { documentos: res.documentos || [], total: res.total || 0, origen: 'api', error: null }
  } catch (e) {
    const locales = await getDocumentosLocales()
    return { documentos: locales, total: locales.length, origen: 'local', error: e.message }
  }
}

export async function obtenerResumen(filtros = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== '' && v !== null && v !== undefined) params.set(k, v)
  }
  const res = await getJson('/compras/documentos/resumen?' + params.toString())
  return res.resumen
}

export async function eliminarDocumento(uid) {
  await deleteJson('/compras/documentos/' + encodeURIComponent(uid))
  await eliminarDocumentoLocal(uid)
}

export async function guardarDocumento(documento) {
  const doc = prepararDocumento(documento)
  const [local] = await guardarDocumentosLocal([doc])
  try {
    const res = await putJson('/compras/documentos/' + encodeURIComponent(local.uid), doc)
    await marcarSincronizado(local.uid, res.documento || {})
    return { documento: res.documento, offline: false }
  } catch (e) {
    await agregarPendiente(TIPO_SYNC_COMPRAS, local, { uid: local.uid })
    return { documento: local, offline: true, error: e.message }
  }
}
