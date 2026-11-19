// ============================================================
// DualLedger - Documentos no fiscales (Compras)
// Helpers puros: no dependen de Vue, IndexedDB ni de la API.
// Estos documentos NO se exportan al Libro de Compras.
// ============================================================

import { formatearRif, normalizarRif, validarRif } from './rif.js'

export const TIPOS_DOCUMENTO_NO_FISCAL = [
  'Recibo',
  'Ticket',
  'Factura no fiscal',
  'Contrato',
  'Recibo de pago',
  'Otro'
]

export function documentoNoFiscalVacio() {
  return {
    uid: '',
    numero: '',
    fecha: '',
    tipo: 'Recibo',
    rif: '',
    proveedor: '',
    concepto: '',
    monto: 0,
    codigoCuenta: '',
    noDeducible: true,
    notas: '',
    archivoNombre: ''
  }
}

// Código de presentación; el uid interno sigue siendo la clave real.
export function codigoDocumentoNoFiscal(indice) {
  const n = Math.max(0, Math.floor(Number(indice) || 0)) + 1
  return `NF-${String(n).padStart(6, '0')}`
}

function fechaValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const d = new Date(`${fecha}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha
}

export function normalizarDocumentoNoFiscal(form) {
  const base = documentoNoFiscalVacio()
  const v = { ...base, ...(form || {}) }
  const rif = normalizarRif(v.rif)
  const fecha = String(v.fecha || '').trim()
  const monto = Math.max(0, Math.round((Number(v.monto) || 0) * 100) / 100)

  return {
    ...v,
    uid: String(v.uid || ''),
    numero: String(v.numero || '').trim(),
    fecha: fechaValida(fecha) ? fecha : '',
    tipo: TIPOS_DOCUMENTO_NO_FISCAL.includes(v.tipo) ? v.tipo : 'Otro',
    rif,
    proveedor: String(v.proveedor || '').trim(),
    concepto: String(v.concepto || '').trim(),
    monto,
    codigoCuenta: String(v.codigoCuenta || '').trim(),
    noDeducible: v.noDeducible !== false,
    notas: String(v.notas || '').trim(),
    archivoNombre: String(v.archivoNombre || '').trim()
  }
}

export function validarDocumentoNoFiscal(form) {
  const v = normalizarDocumentoNoFiscal(form)
  if (!v.numero) return 'Indica el número del documento.'
  if (!v.fecha) return 'Indica una fecha válida (AAAA-MM-DD).'
  if (!v.concepto) return 'Escribe el concepto del gasto.'
  if (v.monto <= 0) return 'El monto debe ser mayor que cero.'
  if (v.rif) {
    const chequeo = validarRif(v.rif)
    if (!chequeo.valido) return chequeo.error
  }
  return ''
}

export function formatearRifOpcional(rif) {
  return rif ? formatearRif(rif) : '—'
}

export function totalDocumentosNoFiscales(documentos) {
  return (documentos || []).reduce((sum, d) => sum + (Number(d.monto) || 0), 0)
}
