// ============================================================
// DualLedger - Maestro de proveedores (Compras → Proveedores)
// Helpers puros, sin dependencias de Vue ni de IndexedDB, para
// poder probarlos con node:test.
// ============================================================

import { formatearRif, validarRif } from './rif.js'

export const RETENCIONES_IVA = [75, 100]

// Clasificaciones habituales del manual del módulo de compras.
// Son solo sugerencias: el usuario puede escribir otra.
export const CLASIFICACIONES_SUGERIDAS = [
  'Honorarios profesionales',
  'Servicios de transporte y fletes',
  'Arrendamiento de bienes inmuebles',
  'Publicidad y propaganda',
  'Contratistas',
  'Comisiones y intermediación',
  'Otros gastos deducibles'
]

export function proveedorVacio() {
  return {
    rif: '',
    nombre: '',
    direccion: '',
    direccionFiscal: '',
    telefono: '',
    porcentajeRetIva: 75,
    conceptoIslr: '',
    codigoCuenta: '',
    creditoFiscalNoDeducible: false,
    condicion: '',
    codigoValidacion: '',
    clasificacion: '',
    extranjero: false,
    diasCredito: 0
  }
}

// Código de presentación del manual (00000001, 00000002, ...).
// El RIF sigue siendo la clave real del registro.
export function codigoProveedor(indice) {
  const n = Math.max(0, Math.floor(Number(indice) || 0)) + 1
  return String(n).padStart(8, '0')
}

export function normalizarProveedor(form) {
  const base = proveedorVacio()
  const v = { ...base, ...(form || {}) }
  const chequeo = validarRif(v.rif)

  return {
    ...v,
    rif: chequeo.valido ? chequeo.rif : String(v.rif || '').trim().toUpperCase(),
    nombre: String(v.nombre || '').trim(),
    direccion: String(v.direccion || '').trim(),
    direccionFiscal: String(v.direccionFiscal || '').trim(),
    telefono: String(v.telefono || '').trim(),
    condicion: String(v.condicion || '').trim(),
    codigoValidacion: String(v.codigoValidacion || '').trim(),
    clasificacion: String(v.clasificacion || '').trim(),
    porcentajeRetIva: Number(v.porcentajeRetIva) === 100 ? 100 : 75,
    diasCredito: Math.max(0, Math.floor(Number(v.diasCredito) || 0)),
    creditoFiscalNoDeducible: v.creditoFiscalNoDeducible === true,
    extranjero: v.extranjero === true,
    conceptoIslr: v.conceptoIslr || '',
    codigoCuenta: v.codigoCuenta || ''
  }
}

// Devuelve '' cuando el formulario es válido; si no, el mensaje a mostrar.
export function validarProveedor(form, { existentes = [], esNuevo = true } = {}) {
  const chequeo = validarRif(form && form.rif)
  if (!chequeo.valido) return chequeo.error
  if (!String((form && form.nombre) || '').trim()) {
    return 'Escribe el nombre o razón social del proveedor.'
  }
  if (esNuevo && existentes.some((p) => p.rif === chequeo.rif)) {
    return `Ya existe un proveedor con RIF ${formatearRif(chequeo.rif)}.`
  }
  return ''
}
