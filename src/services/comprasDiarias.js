// ============================================================
// DualLedger - Compras diarias (manual 1.3 / 1.3.1)
// Helpers puros: convierten la ficha de factura en un registro
// del Libro de Compras y calculan las retenciones que, según el
// manual 1.3.1.4, se generan automáticamente al guardar.
// ============================================================

import { formatearRif, normalizarRif, validarRif } from './rif.js'

export const TIPOS_DOCUMENTO_COMPRA = [
  { value: 'factura', label: 'FC', descripcion: 'Factura de compra' },
  { value: 'nota_debito', label: 'ND', descripcion: 'Nota de débito' },
  { value: 'nota_credito', label: 'NC', descripcion: 'Nota de crédito' }
]

export const ALICUOTAS_IVA = [0, 8, 16]

export function lineaVacia() {
  return {
    codigo: '',
    descripcion: '',
    cantidad: 1,
    precio: 0,
    tipo: 'Servicio',
    alicuotaIVA: 16
  }
}

export function facturaVacia() {
  return {
    uid: '',
    proveedorRif: '',
    proveedorNombre: '',
    direccion: '',
    fechaEmision: '',
    fechaVence: '',
    fechaDeclaracion: '',
    tipoDocumento: 'factura',
    nroFactura: '',
    nroControl: '',
    docAplica: '',
    status: 'PENDIENTE',
    importacion: false,
    creditoFiscalNoDeducible: false,
    obras: '',
    almacen: '',
    nroPlanilla: '',
    comentarios: '',
    expediente: '',
    requisicion: '',
    fletesOtrosGastos: 0,
    documentoDigital: '',
    codigoCuenta: '',
    porcentajeContribucion: 75,
    conceptoIslr: '',
    aplicarIgtf: false,
    detalles: []
  }
}

function num(v, def = 0) {
  const n = Number(v)
  return isFinite(n) ? n : def
}

function red(v, d = 2) {
  const f = Math.pow(10, d)
  return Math.round(num(v) * f) / f
}

function texto(v) {
  return String(v == null ? '' : v).trim()
}

// La vista pasa objetos reactivos de Vue (Proxies). IndexedDB solo puede
// estructurar datos planos, así que se clonan antes de guardarlos en payload.
function clon(v) {
  return v == null ? {} : JSON.parse(JSON.stringify(v))
}

export function calcularLinea(linea) {
  const l = { ...lineaVacia(), ...(linea || {}) }
  const cantidad = Math.max(0, num(l.cantidad, 1))
  const precio = Math.max(0, num(l.precio))
  const alicuota = ALICUOTAS_IVA.includes(Number(l.alicuotaIVA)) ? Number(l.alicuotaIVA) : 16
  const subTotal = red(cantidad * precio)
  const montoIva = red(subTotal * alicuota / 100)
  return {
    ...l,
    cantidad,
    precio,
    alicuotaIVA: alicuota,
    subTotal,
    montoIva,
    total: red(subTotal + montoIva)
  }
}

export function calcularTotales(factura, tasaIGTF = 3) {
  const lineas = (factura && factura.detalles || []).map(calcularLinea)
  const subtotal = red(lineas.reduce((s, l) => s + l.subTotal, 0))
  const exento = red(lineas.filter((l) => l.alicuotaIVA === 0).reduce((s, l) => s + l.subTotal, 0))
  const baseImponible = red(subtotal - exento)
  const iva = red(lineas.reduce((s, l) => s + l.montoIva, 0))
  const fletes = Math.max(0, num(factura && factura.fletesOtrosGastos))
  const totalGeneral = red(subtotal + iva + fletes)
  const tasa = Math.max(0, num(tasaIGTF, 3))
  const igtf = factura && factura.aplicarIgtf ? red(totalGeneral * tasa / 100) : 0

  return { subtotal, exento, baseImponible, iva, fletes, totalGeneral, igtf, lineas }
}

// Comprobantes con el formato del SENIAT visto en las capturas:
//   IVA  -> AAAAMM########  (ej. 20260900004134)
//   ISLR -> ##########      (ej. 0000000063)
export function generarComprobantes(fechaDeclaracion, secuencia = 1) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.test(fechaDeclaracion || '')
    ? fechaDeclaracion
    : new Date().toISOString().slice(0, 10)
  const anioMes = iso.slice(0, 4) + iso.slice(5, 7)
  const n = Math.max(1, Math.floor(num(secuencia, 1)))
  return {
    comprobanteIVA: `${anioMes}${String(n).padStart(8, '0')}`,
    comprobanteISLR: String(n).padStart(10, '0')
  }
}

// Retención IVA = base imponible × alícuota × % de contribución.
// Retención ISLR = (base × % / 100) − (sustraendo × UT), si supera
// la base mínima en UT. El concepto se toma del maestro editable.
export function calcularRetenciones(factura, options = {}) {
  const totales = options.totales || calcularTotales(factura, options.tasaIGTF)
  const fecha = factura.fechaDeclaracion || new Date().toISOString().slice(0, 10)
  const comprobantes = generarComprobantes(fecha, options.secuencia)
  const alicuota = totales.lineas.find((l) => l.alicuotaIVA > 0)
    ? totales.lineas.find((l) => l.alicuotaIVA > 0).alicuotaIVA
    : 16
  const pct = num(factura.porcentajeContribucion, 0)
  const retIva = red(totales.baseImponible * alicuota / 100 * pct / 100)

  const ut = Math.max(0, num(options.unidadTributaria))
  const concepto = (options.conceptos || []).find((c) => c.codigo === factura.conceptoIslr && c.activo !== false)
  let retIslr = 0
  if (concepto && ut > 0 && totales.baseImponible >= num(concepto.baseMinimaUt) * ut) {
    retIslr = red(Math.max(0, totales.baseImponible * num(concepto.porcentaje) / 100 - num(concepto.sustraendoUt) * ut))
  }

  return {
    retIva,
    retIslr,
    baseIva: totales.baseImponible,
    alicuota,
    fechaRetencion: fecha,
    ...comprobantes,
    conceptoIslr: factura.conceptoIslr || '',
    detalleIslr: concepto
      ? {
          codigo: concepto.codigo,
          nombre: concepto.nombre,
          porcentaje: num(concepto.porcentaje),
          sustraendoUt: num(concepto.sustraendoUt),
          unidadTributaria: ut
        }
      : null
  }
}

export function validarFacturaDiaria(factura) {
  const f = factura || {}
  if (!f.proveedorRif) return 'Selecciona el proveedor de la factura.'
  const rif = validarRif(f.proveedorRif)
  if (!rif.valido) return rif.error
  if (!texto(f.proveedorNombre)) return 'El proveedor debe tener nombre o razón social.'
  if (!texto(f.nroFactura)) return 'Indica el número de factura.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fechaEmision || '')) return 'Indica la fecha de emisión.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fechaDeclaracion || '')) return 'Indica la fecha de declaración.'
  if (!texto(f.codigoCuenta)) return 'Selecciona la cuenta contable a imputar.'
  if (!f.detalles || !f.detalles.length) return 'Agrega al menos una línea en Detalles.'
  if (!f.detalles.some((d) => num(d.precio) > 0)) return 'El monto de la factura debe ser mayor que cero.'
  return ''
}

// Convierte la ficha en el registro que espera `prepararDocumento`
// de src/services/compras.js (columnas del Libro de Compras).
export function aDocumentoLibro(factura, options = {}) {
  const f = { ...facturaVacia(), ...clon(factura) }
  const totales = options.totales || calcularTotales(f, options.tasaIGTF)
  const retenciones = options.retenciones || calcularRetenciones(f, options)
  const rif = validarRif(f.proveedorRif)
  const rifMostrar = rif.valido ? formatearRif(rif.rif) : texto(f.proveedorRif)
  const tipo = TIPOS_DOCUMENTO_COMPRA.some((t) => t.value === f.tipoDocumento) ? f.tipoDocumento : 'factura'

  const notas = [
    f.comentarios,
    f.requisicion && `Requisición: ${f.requisicion}`,
    f.obras && `Obras: ${f.obras}`,
    f.docAplica && `Doc. aplica: ${f.docAplica}`,
    f.documentoDigital && `Digital: ${f.documentoDigital}`
  ].filter(Boolean).join(' | ')

  return {
    uid: f.uid,
    fecha: f.fechaEmision,
    rif: rifMostrar,
    nombreRazon: texto(f.proveedorNombre),
    nroFactura: texto(f.nroFactura),
    nroControl: texto(f.nroControl),
    nroNotaDebito: tipo === 'nota_debito' ? texto(f.nroFactura) : '',
    nroNotaCredito: tipo === 'nota_credito' ? texto(f.nroFactura) : '',
    tipoDocumento: tipo,
    totalComprasIVA: totales.totalGeneral,
    noGravadas: totales.exento,
    baseNacional: totales.baseImponible,
    alicuotaNac: retenciones.alicuota,
    creditoFiscalNac: f.creditoFiscalNoDeducible ? 0 : totales.iva,
    retIVA: retenciones.retIva,
    comprobanteIVA: retenciones.comprobanteIVA,
    fechaIVA: retenciones.fechaRetencion,
    igtf: totales.igtf,
    proveedorRif: normalizarRif(f.proveedorRif),
    codigoCuenta: texto(f.codigoCuenta),
    diasCredito: 0,
    porcentajeContribucion: f.porcentajeContribucion,
    condicion: texto(f.status),
    conceptoIslr: texto(f.conceptoIslr),
    estado: 'VALIDADO',
    origen: 'manual',
    notas,
    numExpediente: texto(f.expediente),
    numPlanilla: texto(f.nroPlanilla),
    payload: clon({
      origenModulo: 'compras_diarias',
      factura: f,
      totales,
      retenciones,
      detalles: totales.lineas,
      importacion: f.importacion === true,
      fechaDeclaracion: f.fechaDeclaracion,
      fechaVence: f.fechaVence,
      fletesOtrosGastos: totales.fletes
    })
  }
}
